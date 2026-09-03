import { z } from "zod";
import { ALL_SECTIONS, type SectionKey } from "@/lib/quote-defaults";
import type { RuleKey } from "@/lib/ground-rules";

/**
 * What this quote should carry, worked out before it is written.
 *
 * The order used to be: pick your sections from a list of seven, then generate
 * and find out what you got. Which asks somebody to decide whether this job
 * needs an assumptions list before anything has read the brief. The people
 * best placed to answer that question are the ones who least need the help.
 *
 * So the brief is read first, cheaply, and comes back with a handful of
 * sections and a line each saying why this particular job wants them. Nothing
 * is applied on its own: every suggestion is a chip you can take or leave, and
 * the reason is shown next to it so taking it is a decision rather than a
 * default.
 *
 * Two sources, merged. The model reads the brief and judges what the work
 * needs. The account's ground rules contribute the ones that are true of every
 * quote regardless of the job. A section both agree on is stronger, and the
 * reason shown is the rule's, since "your own rule says so" is a better answer
 * than anything a model will write.
 */
export interface SectionSuggestion {
  key: SectionKey;
  /** One line, in the quote's language, saying why this job wants it. */
  reason: string;
  /** Present when a ground rule is what put it here. */
  rule?: RuleKey;
}

export const suggestionResponseSchema = z.object({
  sections: z
    .array(
      z.object({
        key: z.string(),
        reason: z.string(),
      })
    )
    .default([]),
  /**
   * Whether the brief describes something the freelancer has actually seen.
   *
   * The single most expensive unknown in freelance quoting: a price given for
   * a product nobody has opened. It does not change a section on its own, it
   * changes how loudly the assumptions list is argued for.
   */
  sightUnseen: z.boolean().default(false),
});

export type SuggestionResponse = z.infer<typeof suggestionResponseSchema>;

/** Which section a rule wants, for the rules that want one. */
const RULE_SECTIONS: Partial<Record<RuleKey, SectionKey>> = {
  paymentBasis: "includeSOW",
  revisionRounds: "includeRevisions",
  assumptions: "includeAssumptions",
  scopeChanges: "includeScopeChanges",
  cancellation: "includeTerms",
  ownership: "includeTerms",
  exclusions: "includeScopeChanges",
};

/**
 * The sections the account's own rules ask for.
 *
 * Deterministic and free: no model call decides whether somebody's stated rule
 * applies to their own quote. Deduplicated on the section rather than the
 * rule, because two rules wanting Terms is still one Terms section, and the
 * first rule in the list is the one whose reasoning gets shown.
 */
export function ruleSuggestions(
  activeRules: string[],
  reasonFor: (rule: RuleKey) => string
): SectionSuggestion[] {
  const out: SectionSuggestion[] = [];
  const seen = new Set<SectionKey>();
  for (const [rule, section] of Object.entries(RULE_SECTIONS) as [RuleKey, SectionKey][]) {
    if (!activeRules.includes(rule)) continue;
    if (seen.has(section)) continue;
    seen.add(section);
    out.push({ key: section, reason: reasonFor(rule), rule });
  }
  return out;
}

function isSection(value: string): value is SectionKey {
  return (ALL_SECTIONS as string[]).includes(value);
}

/**
 * The model's reading and the account's rules, as one list.
 *
 * Rules win on collision. A reason drawn from something the freelancer wrote
 * down themselves carries more than one a model composed a second ago, and
 * seeing your own rule quoted back is what makes the rulebook feel like it is
 * doing something.
 */
export function mergeSuggestions(
  fromModel: SuggestionResponse,
  fromRules: SectionSuggestion[]
): SectionSuggestion[] {
  const byKey = new Map<SectionKey, SectionSuggestion>();

  for (const item of fromModel.sections) {
    const key = item.key.trim();
    if (!isSection(key)) continue;
    const reason = item.reason.trim();
    if (!reason) continue;
    if (!byKey.has(key)) byKey.set(key, { key, reason });
  }
  for (const item of fromRules) byKey.set(item.key, item);

  // Back into the canonical order, so the chips do not reshuffle between one
  // quote and the next.
  return ALL_SECTIONS.map((key) => byKey.get(key)).filter(
    (item): item is SectionSuggestion => Boolean(item)
  );
}

/** The prompt. Short on purpose: this runs before anyone has committed to
 * anything, so it has to come back fast enough to feel like part of typing. */
export function buildSuggestPrompt(input: {
  sourceText: string;
  instructions?: string;
  disciplineLine?: string;
  language: string;
}): { system: string; user: string } {
  const system = [
    "You read a freelancer's project brief and say which sections their quote should carry.",
    `Respond with ONLY valid JSON, no markdown fences, in exactly this shape: {"sections": [{"key": "...", "reason": "..."}], "sightUnseen": boolean}.`,
    `Every "key" must be one of: ${ALL_SECTIONS.join(", ")}.`,
    'Each "reason" is ONE short sentence, at most about 15 words, saying what it is about THIS brief that wants that section. Name the actual thing: "three stakeholders review, so rounds need a number", not "revisions are important".',
    "Choose between two and five sections. A quote of everything is a quote nobody reads, and the freelancer is choosing from your list rather than receiving it.",
    'Set "sightUnseen" true when the brief describes a product, file, codebase or body of work that the freelancer has clearly not opened yet, so any price rests on quantities nobody has counted.',
    "Never suggest a section you would have to invent facts to fill.",
    `Write every reason in this language: ${input.language}.`,
  ].join(" ");

  const user = [
    input.disciplineLine ? `The freelancer: ${input.disciplineLine}` : "",
    input.instructions ? `What they said about the job: ${input.instructions}` : "",
    "The brief:",
    // Long briefs get cut: the shape of a job is legible in its first pages,
    // and this call is meant to be quick and cheap rather than exhaustive.
    input.sourceText.slice(0, 6000),
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}
