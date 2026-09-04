"use server";

import { requireFullUser } from "@/lib/session";
import { enforceLlmRateLimit } from "@/lib/rate-limit";
import { planQuote } from "@/lib/anthropic";
import { mergeSuggestions, ruleSuggestions } from "@/lib/suggest-sections";
import type { QuotePlan } from "@/lib/quote-plan";
import { GROUND_RULES, parseRuleSettings, ruleValues } from "@/lib/ground-rules";
import { ruleWords } from "@/lib/rule-words";
import { allDisciplines, disciplineLine } from "@/lib/industries";
import { historyForClient } from "@/lib/client-db";
import { levelFromHistory, NO_HISTORY, type ClientHistory } from "@/lib/clients";
import { dict, resolveQuoteLocale } from "@/lib/i18n";

/**
 * Why there is no plan.
 *
 * Named rather than folded into one message, because the wizard used to treat
 * every failure the same way: it silently wrote the quote instead, so a brief
 * too short to read, a busy minute and a genuine failure all looked identical
 * from the outside, which is to say they looked like the step not existing.
 */
export type PlanFailure = "tooShort" | "busy" | "unreadable";

/** Below this there is not enough to read. */
const MIN_BRIEF = 120;

export interface PlannedQuote extends QuotePlan {
  /** The rules that will be applied, already worded as positions. */
  rules: { key: string; statement: string }[];
  /** What has happened with this client before. See lib/clients. */
  history: ClientHistory;
}

/** The history, as the one line that explains the proposed level. */
function historyReason(
  reason: NonNullable<ReturnType<typeof levelFromHistory>>["reason"],
  history: ClientHistory,
  words: ReturnType<typeof dict>
): string {
  const w = words.quote;
  if (reason === "overdue") {
    return w.historyOverdue.replace("{count}", String(history.overdueInvoices));
  }
  if (reason === "paidLate") {
    return w.historyPaidLate.replace("{days}", String(history.typicalPaymentDays));
  }
  if (reason === "good") {
    return w.historyGood.replace("{count}", String(history.quotes));
  }
  return "";
}

/**
 * Reading the brief and saying what the quote will be, before writing it.
 *
 * The middle step. Pressing Generate used to spend the expensive call
 * immediately and hand back a finished document; a misreading then cost a
 * second full generation to correct. Now the cheap read comes first, the
 * freelancer corrects the understanding, and the quote gets written once from
 * something already agreed.
 *
 * The account's rules go in as positions rather than as problems, so the plan
 * is made around them instead of proposing them back.
 */
export async function planQuoteAction(input: {
  sourceText: string;
  instructions?: string;
  /** The client's name, when the freelancer already knows it. */
  client?: string;
}): Promise<
  { ok: true; data: PlannedQuote } | { ok: false; error: string; reason: PlanFailure }
> {
  try {
    const user = await requireFullUser();
    // Too little to read is not a brief. Below this a model produces confident
    // guesses about a job nobody has described.
    if (input.sourceText.trim().length < MIN_BRIEF) {
      return {
        ok: false,
        reason: "tooShort",
        error: "There is not enough here to read yet. Paste more, or write the quote as it is.",
      };
    }

    try {
      await enforceLlmRateLimit(user.id);
    } catch {
      // Separated from the catch below so a queue does not read as an
      // unreadable brief: one is worth waiting a moment for and the other is
      // not.
      return {
        ok: false,
        reason: "busy",
        error: "Freely is busy for a moment. Try again, or write the quote as it is.",
      };
    }

    const settings = parseRuleSettings(
      (user as unknown as { groundRules?: unknown }).groundRules
    );
    const values = ruleValues(settings);
    const locale = resolveQuoteLocale(user);
    const words = dict(locale);

    // The rules as sentences, with their figures filled in. The same strings
    // the rules page shows, so the plan cannot describe a rule differently
    // from the page that sets it.
    const active = GROUND_RULES.filter(
      (rule) => rule.checkable && !settings.off.includes(rule.key)
    ).map((rule) => ({
      key: rule.key,
      statement: ruleWords(rule.key, words).statement.replace(
        /\{(\w+)\}/g,
        (_, name: string) => String(values[name as keyof typeof values] ?? "")
      ),
    }));

    const disciplines = allDisciplines(
      user.industry,
      (user as unknown as { otherIndustries?: string[] }).otherIndustries
    );

    const plan = await planQuote({
      sourceText: input.sourceText,
      instructions: input.instructions,
      disciplineLine: disciplineLine(
        user.industry,
        disciplines.filter((key) => key !== user.industry)
      ),
      language: locale === "es" ? "Spanish" : "English",
      ruleStatements: active.map((rule) => rule.statement),
    });

    if (!plan) {
      return {
        ok: false,
        reason: "unreadable",
        error: "Couldn't make sense of that brief. You can still write the quote.",
      };
    }

    // The account's own rules get the last word on which sections appear, the
    // same way they do in the wizard.
    const sections = mergeSuggestions(
      { sections: plan.sections, sightUnseen: plan.sightUnseen },
      ruleSuggestions(
        active.map((rule) => rule.key),
        (rule) => ruleWords(rule, words).title
      )
    );

    /**
     * What you already know about these people beats what a brief implies.
     *
     * The model reads the text and can only guess at the relationship. The
     * history is fact: three quotes, all won, all paid inside a week is a
     * different engagement from a stranger with the same brief, and an
     * invoice of theirs already overdue is a different one again.
     */
    const history = input.client ? await historyForClient(user, input.client) : NO_HISTORY;
    const fromHistory = levelFromHistory(history);
    const known = fromHistory && fromHistory.reason !== "new" && fromHistory.reason !== "unproven";

    return {
      ok: true,
      data: {
        ...plan,
        protection: known ? fromHistory.level : plan.protection,
        risks: known
          ? [historyReason(fromHistory.reason, history, words), ...plan.risks].filter(Boolean)
          : plan.risks,
        sections: sections.map((s) => ({ key: s.key, reason: s.reason })),
        rules: active,
        history,
      },
    };
  } catch (err) {
    console.error("[planQuoteAction] failed", err);
    return {
      ok: false,
      reason: "unreadable",
      error: "Couldn't make sense of that brief. You can still write the quote.",
    };
  }
}
