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
/**
 * Example steers, chosen for the work the freelancer actually does.
 *
 * These were four design examples shown to everyone, so a data scientist was
 * offered "Agree the visual direction before any design starts", which is not
 * a sentence about their job. Two of the four were about money and are gone
 * entirely: rate and payment answer those now, in one place.
 *
 * Grouped into families rather than written per role. Thirteen roles times
 * three examples times two languages is seventy-eight strings nobody would
 * keep good, and the sequencing question is genuinely the same across, say,
 * frontend and backend work.
 *
 * Keys into the dictionary rather than the text itself, so they are translated
 * with everything else.
 */
export type ProjectPresetKey =
  | "presetSignOffDesign"
  | "presetSignOffBuild"
  | "presetSignOffData"
  | "presetSignOffWords"
  | "presetResearchFirst"
  | "presetSmallFirstPhase";

const PRESETS_BY_FAMILY: Record<string, ProjectPresetKey> = {
  "ux-designer": "presetSignOffDesign",
  "product-designer": "presetSignOffDesign",
  "brand-designer": "presetSignOffDesign",
  "frontend-developer": "presetSignOffBuild",
  "backend-developer": "presetSignOffBuild",
  "fullstack-developer": "presetSignOffBuild",
  "mobile-developer": "presetSignOffBuild",
  "data-engineer": "presetSignOffData",
  "data-scientist": "presetSignOffData",
  marketing: "presetSignOffWords",
  "content-creator": "presetSignOffWords",
  consultant: "presetSignOffWords",
};

/**
 * The examples to offer this freelancer.
 *
 * The first is the one that depends on their field; the other two are true of
 * any project. An unrecognised industry, including the free text someone typed
 * under "other", gets the two general ones rather than a guess.
 */
export function projectPresetKeys(industry?: string | null): ProjectPresetKey[] {
  const specific = industry ? PRESETS_BY_FAMILY[industry] : undefined;
  const general: ProjectPresetKey[] = ["presetResearchFirst", "presetSmallFirstPhase"];
  return specific ? [specific, ...general] : general;
}

export interface QuoteInclusion {
  key:
    | "includeStrategy"
    | "includeTimeline"
    | "includeSOW"
    | "includeAI"
    | "includeTerms"
    | "includeAvailability"
    | "includeRevisions";
  /** Dictionary keys, so the list is translated with everything else. */
  labelKey:
    | "sectionStrategy"
    | "sectionTimeline"
    | "sectionSow"
    | "sectionTerms"
    | "sectionRevisions"
    | "sectionAvailability"
    | "sectionAi";
  hintKey:
    | "sectionStrategyHint"
    | "sectionTimelineHint"
    | "sectionSowHint"
    | "sectionTermsHint"
    | "sectionRevisionsHint"
    | "sectionAvailabilityHint"
    | "sectionAiHint";
}

export const QUOTE_INCLUSIONS: QuoteInclusion[] = [
  {
    key: "includeStrategy",
    labelKey: "sectionStrategy",
    hintKey: "sectionStrategyHint",
  },
  {
    key: "includeTimeline",
    labelKey: "sectionTimeline",
    hintKey: "sectionTimelineHint",
  },
  {
    key: "includeSOW",
    labelKey: "sectionSow",
    hintKey: "sectionSowHint",
  },
  {
    key: "includeTerms",
    labelKey: "sectionTerms",
    hintKey: "sectionTermsHint",
  },
  {
    key: "includeRevisions",
    labelKey: "sectionRevisions",
    hintKey: "sectionRevisionsHint",
  },
  {
    key: "includeAvailability",
    labelKey: "sectionAvailability",
    hintKey: "sectionAvailabilityHint",
  },
  {
    key: "includeAI",
    labelKey: "sectionAi",
    hintKey: "sectionAiHint",
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
  /** Dictionary keys, so the question is translated with the rest. */
  promptKey: "askPayment" | "askTerms" | "askRevisions" | "askAiUsage";
  placeholderKey:
    | "askPaymentPlaceholder"
    | "askTermsPlaceholder"
    | "askRevisionsPlaceholder"
    | "askAiUsagePlaceholder";
}

/**
 * The questions a section asks, where the answer rests on a decision only the
 * freelancer can make.
 *
 * "How do you want to be paid?" used to be one of these, on the Statement of
 * Work section. It is gone: payment is asked once, in the rate block, and the
 * terms are written from that answer. Asking again here produced quotes whose
 * payment terms contradicted their own milestone schedule, because the two
 * answers came from different boxes and nothing reconciled them.
 */
export const SECTION_QUESTIONS: SectionQuestion[] = [
  {
    key: "terms",
    inclusion: "includeTerms",
    promptKey: "askTerms",
    placeholderKey: "askTermsPlaceholder",
  },
  {
    key: "revisions",
    inclusion: "includeRevisions",
    promptKey: "askRevisions",
    placeholderKey: "askRevisionsPlaceholder",
  },
  {
    key: "aiUsage",
    inclusion: "includeAI",
    promptKey: "askAiUsage",
    placeholderKey: "askAiUsagePlaceholder",
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
