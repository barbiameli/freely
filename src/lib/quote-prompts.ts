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

/**
 * How this project should run.
 *
 * This was "How should this be read?", which is a question about the app
 * rather than about the work, and eleven chips that tried to guess what
 * someone might want. What people actually have is one specific opinion about
 * this job: price it fixed, split it by milestone, sign off direction before
 * design starts. So the free text is the input and these are four examples of
 * the kind of thing that belongs in it.
 */
export const PROJECT_PREFERENCE_EXAMPLES: string[] = [
  "Price this fixed rather than by the hour",
  "Split it into milestones with a payment at each",
  "Agree the visual direction before any design starts",
  "Do the research first and present findings before scoping the rest",
];

export const PROJECT_PREFERENCE_PLACEHOLDER =
  "e.g. it is long, so I want the visual direction signed off before the design phase, and payment split across three milestones";

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
 * Availability.
 *
 * This was eleven chips across three questions, which is a form to fill in
 * about your own calendar. What people actually want to say is one or two
 * specific things, so it is a single free text field now and the chips are
 * gone. The placeholder does the teaching.
 */
export const AVAILABILITY_PLACEHOLDER =
  "e.g. could start the first week of September, two days a week, not held unless the quote is agreed";

/** What was said, as facts for the prompt. Empty means the section is
 * skipped rather than invented. */
export function availabilityFacts(note?: string): string[] {
  const trimmed = note?.trim();
  return trimmed ? [trimmed] : [];
}


/**
 * The one question each optional section needs.
 *
 * Only for sections that rest on a decision the model cannot know: how you
 * split payment, what your terms actually are, how many revision rounds you
 * include, which AI tools you genuinely use. Strategy and Timeline are not
 * here, because those are read out of the brief rather than out of your head.
 *
 * All optional. Left blank, the section is still written, just from the brief
 * and past quotes rather than from a stated preference.
 */
export interface SectionQuestion {
  key: "payment" | "terms" | "revisions" | "aiUsage";
  /** Which inclusion reveals it. */
  inclusion: string;
  prompt: string;
  placeholder: string;
}

export const SECTION_QUESTIONS: SectionQuestion[] = [
  {
    key: "payment",
    inclusion: "includeSOW",
    prompt: "How do you want to be paid?",
    placeholder: "e.g. 40% up front, the rest on delivery, invoiced at each milestone",
  },
  {
    key: "terms",
    inclusion: "includeTerms",
    prompt: "Any terms you always work to?",
    placeholder: "e.g. two weeks notice to cancel, I keep the rights until the final invoice clears",
  },
  {
    key: "revisions",
    inclusion: "includeRevisions",
    prompt: "How many rounds do you include?",
    placeholder: "e.g. two rounds per deliverable, anything after that is quoted separately",
  },
  {
    key: "aiUsage",
    inclusion: "includeAI",
    prompt: "Which AI do you actually use, and where?",
    placeholder: "e.g. Claude for first-pass copy and repetitive variants, never for design decisions",
  },
];

export type SectionNotes = Partial<Record<SectionQuestion["key"], string>>;

/** The notes that were actually filled in, as lines for the prompt. */
export function sectionNoteLines(notes: SectionNotes | undefined): SectionNotes {
  if (!notes) return {};
  return Object.fromEntries(
    Object.entries(notes)
      .map(([key, value]) => [key, value?.trim()])
      .filter(([, value]) => Boolean(value))
  );
}

/**
 * Adding or removing an example line from the free text.
 *
 * The examples were links that appended on click, which meant clicking one
 * twice added it twice and there was no way to take it back. They are chips
 * with a selected state now, and this is the text side of that: select adds
 * the line, deselect removes exactly that line and leaves everything else
 * alone.
 *
 * A line edited by hand after being added no longer matches, so deselecting
 * cannot find it. The chip still turns off, since silently deleting a line
 * someone rewrote would be worse than leaving it in place for them to delete.
 */
export function toggleExampleLine(text: string, line: string, add: boolean): string {
  const lines = text.split("\n");
  if (add) {
    if (lines.some((l) => l.trim() === line)) return text;
    return text.trim() ? `${text.trim()}\n${line}` : line;
  }
  return lines
    .filter((l) => l.trim() !== line)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
