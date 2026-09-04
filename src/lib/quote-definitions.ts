/**
 * The words a quote uses that a client cannot look up.
 *
 * A client wrote back on a real quote asking what a "milestone" was, because
 * the document used the word four times and defined it nowhere. He was right
 * to ask. Every trade has words that feel self-evident from the inside, and
 * "milestone" and "round of revisions" are the two that decide what somebody
 * pays and how many times they can change their mind.
 *
 * So the definition travels with the clause, in the same paragraph block, on
 * every surface. Appended to the text rather than rendered as a separate
 * element because the same string is laid out by four web templates and a
 * PDF, and a clause that only carries its definition on one of them is worse
 * than one that carries it nowhere.
 */
export interface DefinitionWords {
  milestoneMeans: string;
  /** The same word, on a quote where the stages are not payment points. */
  milestoneMeansShape: string;
  roundMeans: string;
  billedFixed: string;
  billedTracked: string;
}

/** How the total on this quote actually becomes an invoice. */
export type BillingBasis = "FIXED_TOTAL" | "HOURLY_TRACKED";

/**
 * The basis this quote was written on.
 *
 * Defaults to a fixed total, which is what almost every quote means and what
 * every quote written before this existed meant. The alternative is stated
 * rather than implied: a client cannot be expected to infer from a number
 * whether it is a price or an estimate.
 *
 * The third possibility, hourly billing under a hard ceiling, is deliberately
 * not offered. It caps what a freelancer can earn while leaving the overrun
 * with them, so there is no outcome in which they do better than the ceiling
 * and several in which they do worse. Anyone wanting to protect a client's
 * budget wants a fixed price; anyone wanting to protect their own time wants
 * an estimate with a threshold.
 */
export function billingFromSettings(settings: unknown): BillingBasis {
  const parsed = (settings as { billing?: unknown } | null) ?? {};
  return parsed.billing === "HOURLY_TRACKED" ? "HOURLY_TRACKED" : "FIXED_TOTAL";
}

/**
 * Whether the paragraph has already said which of the two this is.
 *
 * The standard sentence exists for the quotes that leave it unsaid. Appended
 * to one that has already said it, in the freelancer's own words, it reads as
 * the document repeating itself and, worse, disagreeing with itself: a
 * paragraph explaining an hourly arrangement followed by a second paragraph
 * explaining the same arrangement differently is two answers to one question.
 */
const SAYS_TRACKED = [
  "hours actually worked",
  "hours worked",
  "tracked and billed",
  "this is an estimate",
  "horas realmente trabajadas",
  "es una estimación",
];
const SAYS_FIXED = ["fixed total", "fixed price", "precio cerrado", "precio fijo"];

function alreadySaysTheBasis(text: string, billing: BillingBasis): boolean {
  const lower = text.toLowerCase();
  const phrases = billing === "HOURLY_TRACKED" ? SAYS_TRACKED : SAYS_FIXED;
  return phrases.some((phrase) => lower.includes(phrase));
}

function append(text: string, sentence: string): string {
  if (!text?.trim()) return text;
  // Already said, in whatever words the model chose. Saying it twice reads as
  // a document assembled by machine, which is exactly the impression a quote
  // cannot afford.
  return `${text.trim()}\n\n${sentence}`;
}

/**
 * The payment clause, with the two things it leaves unsaid.
 *
 * What a milestone is, when the quote is billed in them, and whether the
 * number at the bottom is the price or an estimate. The second one is the
 * question that gets asked by email every time it is left out: a client
 * cannot tell whether an hourly quote of 13 hours at 50 means they owe 650 or
 * they owe whatever the hours come to.
 */
/**
 * A definition the freelancer has rewritten, or taken out.
 *
 * These sentences are appended at render, so for a long time they were on the
 * client's copy and in no editable field: a definition could contradict the
 * paragraph above it and there was no box to correct it in. Showing them was
 * not enough. It is their document and their client, so the wording is theirs.
 *
 * A string replaces the default. Null means removed. Undefined means they have
 * not touched it and the standard wording stands, which is what almost every
 * quote wants.
 */
export interface DefinitionOverrides {
  milestone?: string | null;
  round?: string | null;
}

export function definitionsFromSettings(settings: unknown): DefinitionOverrides {
  const parsed = (settings as { definitions?: DefinitionOverrides } | null) ?? {};
  return parsed.definitions ?? {};
}

/** What this quote actually says a milestone is, or "" if it says nothing. */
export function milestoneDefinition(
  overrides: DefinitionOverrides,
  words: DefinitionWords,
  billable: boolean
): string {
  const override = overrides.milestone;
  if (override === null) return "";
  if (typeof override === "string" && override.trim()) return override.trim();
  return billable ? words.milestoneMeans : words.milestoneMeansShape;
}

/** What this quote says a round of revisions is, or "" if it says nothing. */
export function roundDefinition(overrides: DefinitionOverrides, words: DefinitionWords): string {
  const override = overrides.round;
  if (override === null) return "";
  if (typeof override === "string" && override.trim()) return override.trim();
  return words.roundMeans;
}

export function paymentClause(
  text: string | undefined,
  options: {
    hasMilestones: boolean;
    billing: BillingBasis;
    fixedPrice: boolean;
    /**
     * Whether the stages are payment points.
     *
     * The definition used to say "each one is invoiced when it is delivered"
     * on every quote that had stages. Once stages could exist without billing
     * by them, that sentence landed under payment terms reading "hours worked
     * are invoiced on completion of the project", so the document defined a
     * payment schedule it did not have, three lines below saying it had a
     * different one. The freelancer could not even delete it: it is appended
     * at render, so it never appears in the editor.
     */
    milestonesBillable?: boolean;
    /**
     * The milestone definition as this quote states it.
     *
     * Passed in rather than looked up, so a freelancer who has reworded it or
     * removed it gets their version on every template and in the PDF.
     */
    definition?: string;
  },
  words: DefinitionWords
): string {
  let out = text ?? "";
  if (options.hasMilestones) {
    const definition =
      options.definition ??
      (options.milestonesBillable === false ? words.milestoneMeansShape : words.milestoneMeans);
    if (definition.trim()) out = append(out, definition);
  }

  // A fixed-price quote never shows a rate, so there is nothing to be
  // ambiguous about and the sentence would be noise.
  if (!options.fixedPrice && !alreadySaysTheBasis(out, options.billing)) {
    out = append(out, options.billing === "HOURLY_TRACKED" ? words.billedTracked : words.billedFixed);
  }
  return out;
}

/** The revisions clause, with "round" defined as this quote defines it. */
export function revisionsClause(
  text: string | undefined,
  words: DefinitionWords,
  definition?: string
): string {
  const sentence = definition ?? words.roundMeans;
  return sentence.trim() ? append(text ?? "", sentence) : (text ?? "");
}
