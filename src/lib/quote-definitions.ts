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
export function paymentClause(
  text: string | undefined,
  options: { hasMilestones: boolean; billing: BillingBasis; fixedPrice: boolean },
  words: DefinitionWords
): string {
  let out = text ?? "";
  if (options.hasMilestones) out = append(out, words.milestoneMeans);

  // A fixed-price quote never shows a rate, so there is nothing to be
  // ambiguous about and the sentence would be noise.
  if (!options.fixedPrice) {
    out = append(out, options.billing === "HOURLY_TRACKED" ? words.billedTracked : words.billedFixed);
  }
  return out;
}

/** The revisions clause, with "round" defined. */
export function revisionsClause(text: string | undefined, words: DefinitionWords): string {
  return append(text ?? "", words.roundMeans);
}
