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
  /**
   * Presets sharing a group are mutually exclusive, so the model never gets
   * two instructions that cancel each other out. "Keep it lean" and "Spell
   * everything out" cannot both be true, and picking both previously left the
   * result down to whichever the model weighted more heavily.
   */
  group?: "shape" | "depth";
}

export const INTERPRETATION_PRESETS: QuotePromptPreset[] = [
  // How the engagement is shaped. One of these at most.
  {
    label: "Suggest the approach",
    text: "Decide the best way to structure this engagement yourself and say why. Consider whether it should be one phase or several, and whether anything needs scoping before the rest can be priced honestly.",
    group: "shape",
  },
  {
    label: "Phase it",
    text: "Break this into distinct phases with their own deliverables, so the client can approve and pay for them one at a time.",
    group: "shape",
  },
  {
    label: "Scope discovery first",
    text: "Treat this as discovery first: price a short paid scoping phase, then describe the likely shape and range of the main engagement without committing to a firm number for it yet.",
    group: "shape",
  },
  {
    label: "One fixed price",
    text: "Keep this as a single fixed-price engagement with one total.",
    group: "shape",
  },
  // How much detail the client sees. One of these at most.
  {
    label: "Keep it lean",
    text: "Keep the whole quote brief and skimmable. Short scope paragraph, tight deliverables list, no padding.",
    group: "depth",
  },
  {
    label: "Spell it all out",
    text: "Spell out every deliverable, assumption and exclusion explicitly. Write it for someone who wants to know exactly what they are buying.",
    group: "depth",
  },
  // Free-standing, combinable with anything above.
  {
    label: "Flag the risks",
    text: "Be explicit about what could push the timeline or cost, and what you are assuming. Do not paper over gaps in the brief.",
  },
  {
    label: "Trim the scope",
    text: "The brief asks for more than the budget implies. Recommend the smallest version that still achieves the goal, and list what you have deliberately left out.",
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
    hint: "The goal, what the brief tells you, and what still needs confirming.",
  },
  {
    key: "includeTimeline",
    label: "Timeline",
    hint: "A week-by-week breakdown.",
  },
  {
    key: "includeSOW",
    label: "Statement of Work",
    hint: "Makes the quote signable, with payment terms and what happens if scope changes.",
  },
  {
    key: "includeTerms",
    label: "Terms",
    hint: "Cancellation, ownership of the work, and confidentiality.",
  },
  {
    key: "includeRevisions",
    label: "Revisions policy",
    hint: "How many rounds are included, and what counts as new work.",
  },
  {
    key: "includeAvailability",
    label: "Availability",
    hint: "Your capacity, start date, and how quickly you reply.",
  },
  {
    key: "includeAI",
    label: "AI-use disclosure",
    hint: "Which parts of this project use AI, and which stay entirely human.",
  },
];

/**
 * Availability options.
 *
 * The Availability section used to be written from nothing: the prompt asked
 * for a start date, a weekly capacity and a response time, none of which the
 * model can know, and told it to stay "non-committal", which is what you say
 * when you are guessing. These are the facts, clicked rather than typed,
 * because the answer is nearly always one of a handful and nobody wants to
 * write a sentence about their own calendar for every quote.
 */
export interface AvailabilityOption {
  id: string;
  label: string;
  /** Which question it answers, so one from each group can be picked without
   * contradicting the others. */
  group: "start" | "capacity" | "response";
}

export const AVAILABILITY_OPTIONS: AvailabilityOption[] = [
  { id: "start-now", label: "Can start straight away", group: "start" },
  { id: "start-2w", label: "Free in about two weeks", group: "start" },
  { id: "start-month", label: "Booked up for a month", group: "start" },
  { id: "start-tbc", label: "Start date to agree", group: "start" },

  { id: "cap-1", label: "About a day a week", group: "capacity" },
  { id: "cap-2", label: "Two to three days a week", group: "capacity" },
  { id: "cap-4", label: "Most of the week", group: "capacity" },
  { id: "cap-full", label: "Full time on this", group: "capacity" },

  { id: "resp-same", label: "Replies the same day", group: "response" },
  { id: "resp-24", label: "Replies within a day", group: "response" },
  { id: "resp-48", label: "Replies within two working days", group: "response" },
];

export const AVAILABILITY_GROUP_LABEL: Record<AvailabilityOption["group"], string> = {
  start: "When you could start",
  capacity: "How much time you can give it",
  response: "How quickly you reply",
};

/** One option per question. Picking a second in the same group replaces the
 * first, so a quote can't promise to start now and be booked for a month. */
export function toggleAvailability(selected: string[], id: string): string[] {
  const option = AVAILABILITY_OPTIONS.find((o) => o.id === id);
  if (!option) return selected;
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  const sameGroup = AVAILABILITY_OPTIONS.filter((o) => o.group === option.group).map((o) => o.id);
  return [...selected.filter((s) => !sameGroup.includes(s)), id];
}

/** The selected options as plain sentences for the prompt. */
export function availabilityFacts(selected: string[], note?: string): string[] {
  const facts = AVAILABILITY_OPTIONS.filter((o) => selected.includes(o.id)).map((o) => o.label);
  if (note?.trim()) facts.push(note.trim());
  return facts;
}
