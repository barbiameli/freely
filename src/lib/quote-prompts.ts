/**
 * Ready-made steers for the wizard's instructions field.
 *
 * "Tell it how to interpret the brief" is a hard prompt to answer from a
 * blank box, and the field was mostly being left empty as a result. These
 * are the things that actually change the shape of a quote, phrased as
 * something you'd click rather than compose. Clicking appends, so several
 * can be combined, and the field stays free text.
 */
export interface QuotePromptPreset {
  label: string;
  /** Appended to the instructions field. Written as an instruction to the
   * model, not as a note to the reader. */
  text: string;
}

export const INTERPRETATION_PRESETS: QuotePromptPreset[] = [
  {
    label: "Suggest the approach",
    text: "Decide the best way to structure this engagement yourself and say why. Consider whether it should be one phase or several, and whether anything needs scoping before the rest can be priced honestly.",
  },
  {
    label: "Phase it",
    text: "Break this into distinct phases with their own deliverables, so the client can approve and pay for them one at a time.",
  },
  {
    label: "Scope discovery first",
    text: "Treat this as discovery first: price a short paid scoping phase, then describe the likely shape and range of the main engagement without committing to a firm number for it yet.",
  },
  {
    label: "One fixed price",
    text: "Keep this as a single fixed-price engagement with one total, rather than splitting it into phases.",
  },
  {
    label: "Flag the risks",
    text: "Be explicit about what could push the timeline or cost, and what you are assuming. Do not paper over gaps in the brief.",
  },
  {
    label: "Trim the scope",
    text: "The brief asks for more than the budget implies. Recommend the smallest version that still achieves the goal, and list what you have deliberately left out.",
  },
  {
    label: "Keep it short",
    text: "Keep the whole quote brief and skimmable. Short scope paragraph, tight deliverables list, no padding.",
  },
  {
    label: "Formal tone",
    text: "Write this for a procurement or legal reader: precise, formal, and unambiguous about what is and is not included.",
  },
];

/** The optional sections a quote can carry. Everything here is off by
 * default: the baseline quote is scope, deliverables and price, and each of
 * these is a deliberate addition rather than something to switch off. */
export interface QuoteInclusion {
  key:
    | "includeStrategy"
    | "includeTimeline"
    | "includeSOW"
    | "includeAI"
    | "includeTerms"
    | "includeAvailability"
    | "includeRevisions";
  label: string;
  hint: string;
}

export const QUOTE_INCLUSIONS: QuoteInclusion[] = [
  {
    key: "includeStrategy",
    label: "Strategy",
    hint: "Your read on the goal, what you found in the brief, and what still needs confirming.",
  },
  {
    key: "includeTimeline",
    label: "Timeline",
    hint: "A week-by-week breakdown instead of a one-line duration.",
  },
  {
    key: "includeSOW",
    label: "Statement of Work",
    hint: "Turns the quote into something signable, with payment terms and what happens if scope changes.",
  },
  {
    key: "includeTerms",
    label: "Terms",
    hint: "Cancellation, ownership of the work, and confidentiality.",
  },
  {
    key: "includeRevisions",
    label: "Revisions policy",
    hint: "How many rounds are included, and what counts as a new request.",
  },
  {
    key: "includeAvailability",
    label: "Availability",
    hint: "Your capacity, start date, and how quickly you reply.",
  },
  {
    key: "includeAI",
    label: "AI-use disclosure",
    hint: "States that AI helped draft this and that you reviewed it.",
  },
];
