"use server";

import { requireFullUser } from "@/lib/session";
import { enforceLlmRateLimit } from "@/lib/rate-limit";
import { planQuote } from "@/lib/anthropic";
import { mergeSuggestions, ruleSuggestions } from "@/lib/suggest-sections";
import type { QuotePlan } from "@/lib/quote-plan";
import { GROUND_RULES, parseRuleSettings, ruleValues } from "@/lib/ground-rules";
import { ruleWords } from "@/lib/rule-words";
import { allDisciplines, disciplineLine } from "@/lib/industries";
import { dict, resolveQuoteLocale } from "@/lib/i18n";

export interface PlannedQuote extends QuotePlan {
  /** The rules that will be applied, already worded as positions. */
  rules: { key: string; statement: string }[];
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
}): Promise<{ ok: true; data: PlannedQuote } | { ok: false; error: string }> {
  try {
    const user = await requireFullUser();
    if (input.sourceText.trim().length < 120) {
      return { ok: false, error: "Add some source material first." };
    }
    await enforceLlmRateLimit(user.id);

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
      return { ok: false, error: "Couldn't read that brief. You can write the quote directly." };
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

    return {
      ok: true,
      data: {
        ...plan,
        sections: sections.map((s) => ({ key: s.key, reason: s.reason })),
        rules: active,
      },
    };
  } catch {
    return { ok: false, error: "Couldn't read that brief. You can write the quote directly." };
  }
}
