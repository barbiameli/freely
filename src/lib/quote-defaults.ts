/**
 * The quote setup: what the wizard stopped asking every time.
 *
 * The wizard asked fourteen things on its first screen, and about four of them
 * were about the job. The rest were about the freelancer: what you charge, how
 * you split payment, which sections you send, what your terms say, how it comes
 * out, what it looks like. Those answers do not change between Tuesday and
 * Thursday, and retyping them was most of the length.
 *
 * So they live on the account. Nothing here is a settings page you have to fill
 * in first: the first quote asks what it always asked, and what you chose
 * becomes your usual. The second quote reads it back as four lines.
 *
 * Two rules keep that honest, and both are load-bearing:
 *
 * A saved value is never overwritten by accident. `learn` only fills rows that
 * have never been decided, so pricing one odd job as a fixed fee does not
 * silently make every future quote fixed-fee. Changing your usual is a
 * deliberate act, which is what `keep` is for.
 *
 * And nothing is hidden. `describeRow` exists so the real values can be read
 * without opening anything, because the failure mode of remembered settings is
 * sending last month's terms without noticing.
 */
import type { RateUnit } from "@/lib/rate-unit";

/**
 * When the money arrives.
 *
 * ON_DELIVERY is the mirror of UPFRONT and was missing: plenty of small jobs
 * are billed once, at the end, and the nearest thing on offer was a split with
 * the deposit set to something small, which says a different thing to a client
 * and produces a different invoice.
 */
export type PaymentPlan = "UPFRONT" | "SPLIT" | "ON_DELIVERY" | "MILESTONE";
export type ExpertiseLevel = "Junior" | "Mid-level" | "Senior" | "Expert";
export type QuoteFormat = "HTML" | "PDF" | "Figma";
export type QuoteTemplate = "classic" | "editorial" | "minimal";
export type QuoteBranding = "freely" | "own" | "mono-light" | "mono-dark";

/** The section toggles, by the keys the generator already uses. */
export type SectionKey =
  | "includeStrategy"
  | "includeTimeline"
  | "includeSOW"
  | "includeTerms"
  | "includeRevisions"
  | "includeAvailability"
  | "includeAssumptions"
  | "includeScopeChanges"
  | "includeAI";

export const ALL_SECTIONS: SectionKey[] = [
  "includeStrategy",
  "includeTimeline",
  "includeSOW",
  "includeTerms",
  "includeRevisions",
  "includeAvailability",
  "includeAssumptions",
  "includeScopeChanges",
  "includeAI",
];

/**
 * What a quote gets when nothing has ever been decided: nothing.
 *
 * Every section is off until it is turned on. Pre-lighting three of them put
 * words in the freelancer's mouth, and this audience knows what belongs in
 * their own quote better than a default does. The first quote asks; from then
 * on the account remembers what was picked.
 */
export const FALLBACK_SECTIONS: SectionKey[] = [];

export const FALLBACK_PAYMENT_PLAN: PaymentPlan = "SPLIT";
export const FALLBACK_UPFRONT_PERCENT = 50;
export const FALLBACK_EXPERTISE: ExpertiseLevel = "Senior";

/** The account columns this reads. All nullable: null means never said. */
export interface AccountDefaults {
  defaultRate?: number | null;
  defaultRateUnit?: string | null;
  currency?: string | null;
  defaultPaymentPlan?: string | null;
  defaultUpfrontPercent?: number | null;
  defaultSections?: unknown;
  defaultTermsNote?: string | null;
  defaultRevisionsNote?: string | null;
  defaultAiUsageNote?: string | null;
  defaultAvailabilityNote?: string | null;
  defaultFormat?: string | null;
  defaultTemplate?: string | null;
  defaultBranding?: string | null;
  expertiseLevel?: string | null;
  inferredExpertise?: string | null;
  /** The main kind of work, which is what defaultRate belongs to. */
  industry?: string | null;
  /** A rate for each of the other kinds of work. See lib/discipline-rates. */
  ratesByDiscipline?: unknown;
}

/** A quote's setup, fully resolved, with no nulls left to think about. */
export interface QuoteSetup {
  rate: number;
  rateUnit: RateUnit;
  currency: string;
  paymentPlan: PaymentPlan;
  upfrontPercent: number;
  sections: SectionKey[];
  termsNote: string;
  revisionsNote: string;
  aiUsageNote: string;
  availabilityNote: string;
  format: QuoteFormat;
  template: QuoteTemplate;
  branding: QuoteBranding;
  expertise: ExpertiseLevel;
}

/**
 * The four lines the wizard shows.
 *
 * Grouped by the decision rather than by the column, which is why presentation
 * is one row: format, template and branding are all the same question about
 * what the client receives, and three rows saying so would be padding.
 */
export type SetupRowKey = "rate" | "payment" | "sections" | "presentation";

export const SETUP_ROWS: SetupRowKey[] = ["rate", "payment", "sections", "presentation"];

/**
 * The rows the wizard asks about, which is not all of them.
 *
 * Presentation is format, branding and style: how the finished document looks.
 * The wizard was asking for all three before the document existed, so the
 * choice was made blind and its result was not seen until a client saw it.
 * Those now live on the quote page, next to a preview.
 *
 * What is left all changes what gets written. That is the line.
 */
export const WIZARD_ROWS: SetupRowKey[] = SETUP_ROWS.filter((row) => row !== "presentation");

/**
 * Seniority, resolved.
 *
 * What you said always beats what was guessed. The guess is read off your
 * persona, files and past work, and only matters at all when there is no rate
 * to anchor to: given a rate, the level adds nothing that figure does not
 * already say, which is why the wizard no longer asks.
 */
export function resolveExpertise(
  stated?: string | null,
  inferred?: string | null
): ExpertiseLevel {
  return asExpertise(stated) ?? asExpertise(inferred) ?? FALLBACK_EXPERTISE;
}

/** Reads the account into a complete setup. */
export function resolveSetup(saved: AccountDefaults): QuoteSetup {
  return {
    rate: saved.defaultRate && saved.defaultRate > 0 ? saved.defaultRate : 0,
    rateUnit: asRateUnit(saved.defaultRateUnit) ?? "HOUR",
    currency: saved.currency || "USD",
    paymentPlan: asPaymentPlan(saved.defaultPaymentPlan) ?? FALLBACK_PAYMENT_PLAN,
    upfrontPercent: asPercent(saved.defaultUpfrontPercent) ?? FALLBACK_UPFRONT_PERCENT,
    sections: asSections(saved.defaultSections) ?? FALLBACK_SECTIONS,
    termsNote: saved.defaultTermsNote ?? "",
    revisionsNote: saved.defaultRevisionsNote ?? "",
    aiUsageNote: saved.defaultAiUsageNote ?? "",
    availabilityNote: saved.defaultAvailabilityNote ?? "",
    format: asFormat(saved.defaultFormat) ?? "PDF",
    template: asTemplate(saved.defaultTemplate) ?? "classic",
    branding: asBranding(saved.defaultBranding) ?? "freely",
    expertise: resolveExpertise(saved.expertiseLevel, saved.inferredExpertise),
  };
}

/**
 * Which rows have actually been decided.
 *
 * The difference between a default and a decision. An undecided row is opened
 * rather than summarised, because "£0/hour, 50% upfront" read back as your
 * usual on a first quote would be a lie about a choice nobody made.
 */
export function decidedRows(saved: AccountDefaults): SetupRowKey[] {
  const decided: SetupRowKey[] = [];
  if (saved.defaultRate && saved.defaultRate > 0) decided.push("rate");
  if (asPaymentPlan(saved.defaultPaymentPlan)) decided.push("payment");
  if (asSections(saved.defaultSections)) decided.push("sections");
  if (saved.defaultFormat || saved.defaultTemplate || saved.defaultBranding) {
    decided.push("presentation");
  }
  return decided;
}

/**
 * Which rows this quote has changed from the usual.
 *
 * Only counts rows that had a usual to differ from: on a first quote nothing
 * is a change, it is all just the answer.
 */
export function changedRows(setup: QuoteSetup, saved: AccountDefaults): SetupRowKey[] {
  const decided = new Set(decidedRows(saved));
  const usual = resolveSetup(saved);
  const changed: SetupRowKey[] = [];

  if (decided.has("rate") && (setup.rate !== usual.rate || setup.rateUnit !== usual.rateUnit)) {
    changed.push("rate");
  }
  if (
    decided.has("payment") &&
    (setup.paymentPlan !== usual.paymentPlan ||
      // Only meaningful on a split. Comparing it on an upfront plan would flag
      // a change nobody made and nothing acts on.
      (setup.paymentPlan === "SPLIT" && setup.upfrontPercent !== usual.upfrontPercent))
  ) {
    changed.push("payment");
  }
  if (decided.has("sections") && !sameSections(setup.sections, usual.sections)) {
    changed.push("sections");
  }
  if (
    decided.has("presentation") &&
    (setup.format !== usual.format ||
      setup.template !== usual.template ||
      setup.branding !== usual.branding)
  ) {
    changed.push("presentation");
  }
  return changed;
}

/** The columns to write. Only ever keys with a value, so it composes with a
 * Prisma update without clearing anything. */
export type DefaultsPatch = Partial<{
  defaultRate: number;
  defaultRateUnit: string;
  defaultPaymentPlan: string;
  defaultUpfrontPercent: number;
  defaultSections: SectionKey[];
  defaultTermsNote: string;
  defaultRevisionsNote: string;
  defaultAiUsageNote: string;
  defaultAvailabilityNote: string;
  defaultFormat: string;
  defaultTemplate: string;
  defaultBranding: string;
}>;

/**
 * What to remember after a quote is generated.
 *
 * Fills the gaps and nothing else. This is the whole reason Memory does not
 * need filling in by hand, and also the reason a one-off cannot damage it: a
 * row that has been decided is left exactly as it was, however this quote was
 * priced. Overwriting is `keep`, and it happens because somebody asked.
 *
 * The free-text notes are treated the same way: your terms are remembered the
 * first time you type them, and never quietly replaced by a sentence you wrote
 * for one unusual client.
 */
export function learn(setup: QuoteSetup, saved: AccountDefaults): DefaultsPatch {
  const decided = new Set(decidedRows(saved));
  const patch: DefaultsPatch = {};

  if (!decided.has("rate") && setup.rate > 0) {
    patch.defaultRate = setup.rate;
    patch.defaultRateUnit = setup.rateUnit;
  }
  if (!decided.has("payment")) {
    patch.defaultPaymentPlan = setup.paymentPlan;
    patch.defaultUpfrontPercent = setup.upfrontPercent;
  }
  if (!decided.has("sections")) {
    patch.defaultSections = setup.sections;
  }
  if (!decided.has("presentation")) {
    patch.defaultFormat = setup.format;
    patch.defaultTemplate = setup.template;
    patch.defaultBranding = setup.branding;
  }

  if (!saved.defaultTermsNote && setup.termsNote.trim()) {
    patch.defaultTermsNote = setup.termsNote.trim();
  }
  if (!saved.defaultRevisionsNote && setup.revisionsNote.trim()) {
    patch.defaultRevisionsNote = setup.revisionsNote.trim();
  }
  if (!saved.defaultAiUsageNote && setup.aiUsageNote.trim()) {
    patch.defaultAiUsageNote = setup.aiUsageNote.trim();
  }
  if (!saved.defaultAvailabilityNote && setup.availabilityNote.trim()) {
    patch.defaultAvailabilityNote = setup.availabilityNote.trim();
  }

  return patch;
}

/**
 * What to write when somebody says "make this my usual".
 *
 * Everything in that one row, overwriting whatever was there. Per row rather
 * than wholesale, because the request is about the line they just changed.
 */
export function keep(row: SetupRowKey, setup: QuoteSetup): DefaultsPatch {
  switch (row) {
    case "rate":
      return { defaultRate: setup.rate, defaultRateUnit: setup.rateUnit };
    case "payment":
      return {
        defaultPaymentPlan: setup.paymentPlan,
        defaultUpfrontPercent: setup.upfrontPercent,
      };
    case "sections":
      return { defaultSections: setup.sections };
    case "presentation":
      return {
        defaultFormat: setup.format,
        defaultTemplate: setup.template,
        defaultBranding: setup.branding,
      };
  }
}

/**
 * The whole setup, for the Memory page.
 *
 * Memory is where these are revisited deliberately, so it writes everything it
 * was given with none of the learning rules involved: no gap-filling, no
 * protection of an existing value. Somebody editing their terms on the Memory
 * page means to change their terms.
 *
 * A blank note is written as blank rather than skipped, because clearing your
 * revision policy there has to actually clear it.
 */
export function everything(setup: QuoteSetup): DefaultsPatch {
  return {
    ...(setup.rate > 0 ? { defaultRate: setup.rate } : {}),
    defaultRateUnit: setup.rateUnit,
    defaultPaymentPlan: setup.paymentPlan,
    defaultUpfrontPercent: setup.upfrontPercent,
    defaultSections: setup.sections,
    defaultTermsNote: setup.termsNote,
    defaultRevisionsNote: setup.revisionsNote,
    defaultAiUsageNote: setup.aiUsageNote,
    defaultAvailabilityNote: setup.availabilityNote,
    defaultFormat: setup.format,
    defaultTemplate: setup.template,
    defaultBranding: setup.branding,
  };
}

/**
 * The words each row needs, as plain strings.
 *
 * An interface of `string` rather than the dictionary type, so a Spanish quote
 * written on an English interface still describes itself in the client's
 * language. Same reason as lib/rate-unit.
 */
export interface SetupWords {
  perHour: string;
  perDay: string;
  fixed: string;
  upfrontAll: string;
  onDelivery: string;
  /** Takes the percentage, e.g. "{n}% upfront, rest on delivery". */
  splitTemplate: string;
  byMilestone: string;
  and: string;
  nothingYet: string;
  /** Sections specifically: none picked is a real state, not a blank. */
  sectionsNone: string;
  sectionNames: Record<SectionKey, string>;
  formats: Record<QuoteFormat, string>;
  templates: Record<QuoteTemplate, string>;
  brandings: Record<QuoteBranding, string>;
}

/**
 * One row as a sentence.
 *
 * The point of the whole design: the values are readable at a glance, so a
 * quote about to go out with the wrong terms is caught by reading rather than
 * by opening four disclosures.
 */
export function describeRow(
  row: SetupRowKey,
  setup: QuoteSetup,
  words: SetupWords,
  symbol: string
): string {
  switch (row) {
    case "rate": {
      if (setup.rate <= 0) return words.nothingYet;
      const amount = `${symbol}${setup.rate.toLocaleString()}`;
      if (setup.rateUnit === "FIXED") return `${amount} ${words.fixed}`;
      return `${amount} ${setup.rateUnit === "DAY" ? words.perDay : words.perHour}`;
    }
    case "payment":
      if (setup.paymentPlan === "UPFRONT") return words.upfrontAll;
      if (setup.paymentPlan === "ON_DELIVERY") return words.onDelivery;
      if (setup.paymentPlan === "MILESTONE") return words.byMilestone;
      return words.splitTemplate.replace("{n}", String(setup.upfrontPercent));
    case "sections": {
      const names = setup.sections.map((key) => words.sectionNames[key]).filter(Boolean);
      if (names.length === 0) return words.sectionsNone;
      return joinWords(names, words.and);
    }
    case "presentation":
      return joinWords(
        [
          words.formats[setup.format],
          words.templates[setup.template],
          words.brandings[setup.branding],
        ].filter(Boolean),
        words.and
      );
  }
}

/** "a, b and c", with the last joiner spelled rather than punctuated. */
function joinWords(parts: string[], and: string): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} ${and} ${parts[parts.length - 1]}`;
}

function sameSections(a: SectionKey[], b: SectionKey[]): boolean {
  if (a.length !== b.length) return false;
  const inA = new Set(a);
  return b.every((key) => inA.has(key));
}

/**
 * Everything below narrows a string off the database into a union.
 *
 * A column holds whatever was written to it, including a value from a version
 * of the app where the set was different. An unrecognised value returns
 * undefined and falls back, rather than being cast and reaching the generator
 * as a template that no longer exists.
 */
function asExpertise(value?: string | null): ExpertiseLevel | undefined {
  return value === "Junior" || value === "Mid-level" || value === "Senior" || value === "Expert"
    ? value
    : undefined;
}

function asRateUnit(value?: string | null): RateUnit | undefined {
  return value === "HOUR" || value === "DAY" || value === "FIXED" ? value : undefined;
}

function asPaymentPlan(value?: string | null): PaymentPlan | undefined {
  return value === "UPFRONT" || value === "SPLIT" || value === "ON_DELIVERY" || value === "MILESTONE"
    ? value
    : undefined;
}

function asPercent(value?: number | null): number | undefined {
  return typeof value === "number" && value > 0 && value < 100 ? Math.round(value) : undefined;
}

function asFormat(value?: string | null): QuoteFormat | undefined {
  return value === "HTML" || value === "PDF" || value === "Figma" ? value : undefined;
}

function asTemplate(value?: string | null): QuoteTemplate | undefined {
  return value === "classic" || value === "editorial" || value === "minimal" ? value : undefined;
}

function asBranding(value?: string | null): QuoteBranding | undefined {
  return value === "freely" || value === "own" || value === "mono-light" || value === "mono-dark"
    ? value
    : undefined;
}

/**
 * The saved section set.
 *
 * A Json column, so it can be anything. Undefined rather than an empty array
 * when it is unusable, because "saved as nothing" and "never saved" have to
 * stay distinguishable: the first is a real choice to send a bare quote, the
 * second is a first quote that should be asked.
 */
function asSections(value: unknown): SectionKey[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const known = new Set<string>(ALL_SECTIONS);
  const keys = value.filter((item): item is SectionKey => typeof item === "string" && known.has(item));
  // A stored array that contained nothing recognisable is corrupt rather than
  // deliberate, and treating it as a choice would send quotes with no sections.
  if (keys.length === 0 && value.length > 0) return undefined;
  return Array.from(new Set(keys));
}
