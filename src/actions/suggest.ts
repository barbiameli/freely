"use server";

import { requireFullUser } from "@/lib/session";
import { enforceLlmRateLimit } from "@/lib/rate-limit";
import { suggestSections } from "@/lib/anthropic";
import {
  mergeSuggestions,
  ruleSuggestions,
  type SectionSuggestion,
} from "@/lib/suggest-sections";
import { GROUND_RULES, parseRuleSettings, type RuleKey } from "@/lib/ground-rules";
import { allDisciplines, disciplineLine } from "@/lib/industries";
import { resolveQuoteLocale } from "@/lib/i18n";
import { dict } from "@/lib/i18n";
import { ruleWords } from "@/lib/rule-words";

/**
 * What this quote should carry, before it is written.
 *
 * Runs on the brief the freelancer has already pasted or uploaded, and comes
 * back with sections and a reason each. Nothing is applied: the wizard shows
 * them as offers.
 *
 * Never throws and never returns an error the wizard has to display. This is a
 * convenience that arrives, or does not; somebody halfway through writing a
 * quote should not be handed a failure about a thing they did not ask for.
 */
export async function suggestSectionsAction(input: {
  sourceText: string;
  instructions?: string;
}): Promise<{ suggestions: SectionSuggestion[]; sightUnseen: boolean }> {
  const empty = { suggestions: [], sightUnseen: false };
  try {
    const user = await requireFullUser();
    // Too little to read is not a brief, and asking a model about two lines
    // produces confident guesses about a job nobody described.
    if (input.sourceText.trim().length < 120) return empty;

    await enforceLlmRateLimit(user.id);

    const settings = parseRuleSettings(
      (user as unknown as { groundRules?: unknown }).groundRules
    );
    const active = GROUND_RULES.filter(
      (rule) => rule.checkable && !settings.off.includes(rule.key)
    ).map((rule) => rule.key);

    const locale = resolveQuoteLocale(user);
    const words = dict(locale);

    const disciplines = allDisciplines(
      user.industry,
      (user as unknown as { otherIndustries?: string[] }).otherIndustries
    );

    const fromModel = await suggestSections({
      sourceText: input.sourceText,
      instructions: input.instructions,
      disciplineLine: disciplineLine(
        user.industry,
        disciplines.filter((key) => key !== user.industry)
      ),
      language: locale === "es" ? "Spanish" : "English",
    });

    const fromRules = ruleSuggestions(active, (rule: RuleKey) => ruleWords(rule, words).title);

    return {
      suggestions: mergeSuggestions(fromModel ?? { sections: [], sightUnseen: false }, fromRules),
      sightUnseen: fromModel?.sightUnseen ?? false,
    };
  } catch {
    return empty;
  }
}
