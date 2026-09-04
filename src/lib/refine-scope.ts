/**
 * Which part of a quote an instruction is actually about.
 *
 * Refining sends the whole quote and gets the whole quote back. That is right
 * when somebody says "make it warmer", and wasteful the rest of the time: a
 * one-line change to the revisions policy rewrites the scope, the deliverables
 * and the timeline on the way past, which is most of the wait and the reason a
 * sentence somebody liked can come back different.
 *
 * So an instruction that clearly names one section is answered with that
 * section alone. Everything ambiguous keeps the old behaviour, because the
 * cost of guessing wrong is an instruction that appears to do nothing, and
 * that is worse than being slow.
 */

/** The parts of a quote that can be rewritten on their own. */
export type RefineScope =
  | "revisions"
  | "paymentTerms"
  | "terms"
  | "availability"
  | "assumptions"
  | "scopeChanges"
  | "aiUsage"
  | "timeline"
  | "deliverables"
  | "scope";

/**
 * Words that name a section, and only that section.
 *
 * Deliberately narrow. "Price" is not here, because changing the price changes
 * the deliverables and the hours behind it, and a scoped rewrite would leave
 * a quote whose parts disagree.
 */
const CUES: Record<RefineScope, string[]> = {
  revisions: ["revision", "revisions", "rounds of changes", "amends", "revisiones", "rondas"],
  paymentTerms: [
    "payment terms",
    "payment schedule",
    "deposit",
    "up front",
    "upfront",
    "when i get paid",
    "condiciones de pago",
    "anticipo",
  ],
  terms: ["cancellation", "kill fee", "ownership", "rights", "confidentiality", "cancelación"],
  availability: ["availability", "start date", "disponibilidad"],
  assumptions: ["assumption", "assumptions", "what the price assumes", "supuesto", "supuestos"],
  scopeChanges: [
    "scope change",
    "what would change the price",
    "exclusions",
    "excluded",
    "fuera de alcance",
  ],
  aiUsage: ["ai use", "ai disclosure", "ai usage", "uso de ia"],
  timeline: ["timeline", "schedule", "weeks", "stages", "cronograma", "calendario"],
  deliverables: ["deliverable", "deliverables", "entregable", "entregables"],
  // Never the bare word "scope": it appears in "out of scope", "scope
  // change" and half the things somebody might say about any section, and it
  // matched the scope paragraph on an instruction about the AI disclosure.
  scope: ["scope paragraph", "scope section", "overview", "summary", "resumen"],
};

/**
 * Instructions that are about the whole document however they are worded.
 *
 * "Make it shorter" mentions no section and means all of them. Tone, length
 * and language are properties of the quote rather than of a part of it, and
 * scoping one of these would produce a document where one section reads
 * differently from the rest.
 */
const WHOLE_QUOTE = [
  "shorter",
  "longer",
  "tone",
  "warmer",
  "friendlier",
  "formal",
  "casual",
  "rewrite",
  "rewrite it",
  "start again",
  "everything",
  "whole",
  "throughout",
  "all of it",
  "simpler",
  "plainer",
  "translate",
  "más corto",
  "más largo",
  "tono",
  "todo",
];

/**
 * The one section this instruction is about, or nothing.
 *
 * Nothing means the whole quote, which is the safe answer and the old
 * behaviour. Two sections also means nothing: "add a cancellation clause and
 * shorten the timeline" is two jobs, and doing one of them is worse than
 * doing both slowly.
 */
export function scopeOf(instruction: string): RefineScope | null {
  const text = instruction.toLowerCase();
  if (!text.trim()) return null;

  // A whole-quote word anywhere wins, because these describe the document
  // rather than a part of it.
  if (WHOLE_QUOTE.some((word) => text.includes(word))) return null;

  const hits: RefineScope[] = [];
  for (const [scope, cues] of Object.entries(CUES) as [RefineScope, string[]][]) {
    if (cues.some((cue) => text.includes(cue))) hits.push(scope);
  }

  /**
   * "Scope" is a word people use for the section and for the idea.
   *
   * It only counts when nothing more specific matched, and "out of scope" is
   * not a cue at all: "take the AI section out of scope" matched the wrong
   * section on it, which is the failure mode this whole file is written to
   * avoid. Phrasings that loose fall back to rewriting everything.
   */
  const specific = hits.filter((scope) => scope !== "scope");
  if (specific.length === 1) return specific[0];
  if (specific.length === 0 && hits.length === 1) return hits[0];
  return null;
}

/** The JSON key a scope maps to, for asking the model for it alone. */
export function keyFor(scope: RefineScope): string {
  return scope;
}

/**
 * Which parts of a scoped answer are allowed to land.
 *
 * The model is asked for one key and given the whole quote to read, so it can
 * and sometimes will return more than it was asked for. Anything beyond the
 * named section is dropped rather than merged: a scoped refine that quietly
 * rewrote the deliverables would be the exact failure this exists to prevent,
 * and it would be invisible.
 */
export function keepOnly<T extends Record<string, unknown>>(
  answer: T,
  scope: RefineScope
): Partial<T> {
  const key = keyFor(scope);
  return key in answer ? ({ [key]: answer[key] } as Partial<T>) : {};
}
