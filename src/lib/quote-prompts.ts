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
 * Ready-made steers, five for the work this freelancer actually does.
 *
 * These were six long sentences used as their own chip labels, so a row of
 * them read as one run-on paragraph: "Do the discovery first and present
 * findings before scoping the restKeep the first phase small so it can be
 * re-scoped after". A chip is a label. The instruction it writes into the field
 * is a different string, and can be a whole sentence because it is read there
 * rather than in a row of pills.
 *
 * Three are true of any project and two depend on the field. Grouped into
 * families rather than written per role, because thirteen roles times five
 * presets times two languages is a hundred and thirty strings nobody would keep
 * good, and the sequencing question is genuinely the same across, say, frontend
 * and backend work.
 *
 * What belongs here is a decision that changes the shape of a quote: what has
 * to be agreed before the next part can start, how it is split, what counts as
 * extra. Not what the work is, which the brief already says, and not what you
 * charge, which rate and payment answer in one place.
 */
export type ProjectPresetKey =
  | "presetPhases"
  | "presetDiscovery"
  | "presetFixedScope"
  | "presetDirectionFirst"
  | "presetHandover"
  | "presetStackFirst"
  | "presetDeploy"
  | "presetDataAccess"
  | "presetBaseline"
  | "presetAngleFirst"
  | "presetSample";

/** True of any project, whatever the field. */
const GENERAL: ProjectPresetKey[] = ["presetPhases", "presetDiscovery", "presetFixedScope"];

/**
 * The two that depend on the field.
 *
 * One about what has to be settled before the work can start, one about what
 * counts as finished, since those are the two things a quote gets wrong when it
 * is written without an opinion about them.
 */
const BY_FAMILY: Record<string, ProjectPresetKey[]> = {
  "ux-designer": ["presetDirectionFirst", "presetHandover"],
  "product-designer": ["presetDirectionFirst", "presetHandover"],
  "brand-designer": ["presetDirectionFirst", "presetHandover"],
  "frontend-developer": ["presetStackFirst", "presetDeploy"],
  "backend-developer": ["presetStackFirst", "presetDeploy"],
  "fullstack-developer": ["presetStackFirst", "presetDeploy"],
  "mobile-developer": ["presetStackFirst", "presetDeploy"],
  "data-engineer": ["presetDataAccess", "presetBaseline"],
  "data-scientist": ["presetDataAccess", "presetBaseline"],
  marketing: ["presetAngleFirst", "presetSample"],
  "content-creator": ["presetAngleFirst", "presetSample"],
  consultant: ["presetAngleFirst", "presetSample"],
};

/**
 * The five to offer this freelancer, field-specific ones first.
 *
 * An unrecognised industry, including whatever somebody typed under "other",
 * gets the three general ones rather than a guess: a data scientist offered
 * "get the direction signed off before detailed design starts" learns only
 * that the app was built for someone else.
 */
export function projectPresetKeys(
  industry?: string | null,
  /**
   * The other things they do.
   *
   * A designer who also builds was being offered design presets only, so the
   * one-press examples covered half their work. Main first, because the chips
   * are read in order and the first few are the ones anybody uses.
   */
  others: string[] = []
): ProjectPresetKey[] {
  const specific = [industry, ...others]
    .filter((key): key is string => Boolean(key))
    .flatMap((key) => BY_FAMILY[key] ?? []);
  // Deduped: two disciplines in the same family share presets, and offering
  // the same chip twice reads as a bug.
  return Array.from(new Set([...specific, ...GENERAL]));
}

/** The short label for a chip, and the sentence it writes into the field. */
export interface ProjectPreset {
  labelKey: ProjectPresetKey;
  textKey: `${ProjectPresetKey}Text`;
}

export function projectPresets(industry?: string | null, others: string[] = []): ProjectPreset[] {
  return projectPresetKeys(industry, others).map((key) => ({
    labelKey: key,
    textKey: `${key}Text` as const,
  }));
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
