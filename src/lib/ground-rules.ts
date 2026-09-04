import type { BriefExtras } from "@/lib/anthropic";
import { isProtectionLevel, protectionFor } from "@/lib/protection";
import { happenings } from "@/lib/deliverable-check";

/**
 * The things a quote should say before it goes out, and what it costs when it
 * does not.
 *
 * Every rule here came from a quote somebody actually sent. A client who could
 * not tell whether a number was a price or an estimate. A revisions policy
 * that said "within reason", which meant one thing to the freelancer and
 * another to the client at exactly the moment it mattered. A project that ran
 * over because the file turned out to hold twenty screens rather than twelve,
 * with nothing written down to say twelve was ever the assumption.
 *
 * None of these are legal advice and none of them are about protecting a
 * freelancer from their client. They are about the two of them agreeing on the
 * same thing, which is what a quote is for.
 *
 * The rules are code and the settings are data: which ones an account has
 * switched off lives on the account, the checks themselves live here, so a
 * rule can be improved without migrating anything.
 */

/** How hard a broken rule pushes back. */
export type Severity = "blocking" | "suggestion";

export type RuleKey =
  | "paymentBasis"
  | "revisionRounds"
  | "assumptions"
  | "scopeChanges"
  | "unpaidStretch"
  | "feedbackWindow"
  | "deemedAcceptance"
  | "cancellation"
  | "ownership"
  | "exclusions"
  | "includedCalls"
  | "deliverablesAreThings"
  | "beforeSignature"
  | "noNumberBeforeScope";

/**
 * A number a rule states out loud.
 *
 * The rules used to be positions without figures: "say when you are paid"
 * rather than "payment is due within 14 days". A rule with no number in it
 * cannot be put on a quote, which meant every one of these still left the
 * actual term to be invented per project.
 *
 * The defaults below are the researched norm rather than anybody's preference,
 * with the reasoning on each one. They are starting points: every account can
 * change every figure, and the rule is stated with whatever number it holds.
 */
export type ValueKey =
  | "paymentDays"
  | "depositPercent"
  | "revisionRounds"
  | "feedbackDays"
  | "acceptanceDays"
  | "callsIncluded"
  | "maxUnpaidHours";

export interface RuleValue {
  key: ValueKey;
  fallback: number;
  min: number;
  max: number;
}

export interface GroundRule {
  key: RuleKey;
  severity: Severity;
  /** The number this rule states, where it states one. */
  value?: RuleValue;
  /** A second number, for the one rule that needs two. */
  extra?: RuleValue;
  /**
   * Whether a quote can be checked against this rule at all.
   *
   * Some of these are practice rather than paperwork: not starting work before
   * a signature is a rule about what you do on a Tuesday, and no amount of
   * reading the document can tell you whether it was followed. Those still
   * belong in the rulebook, because the rulebook is also where somebody learns
   * what they should be doing. They just never raise a flag.
   */
  checkable: boolean;
}

/**
 * The starter set.
 *
 * Written for freelancers generally rather than for any one trade: a
 * developer, a writer, a translator and a designer all get paid late for the
 * same reasons. Nothing here assumes a Figma file or a codebase.
 *
 * Ordered by what tends to hurt most, which is roughly the order a first-time
 * user should read them in.
 */
export const GROUND_RULES: GroundRule[] = [
  {
    key: "paymentBasis",
    severity: "blocking",
    checkable: true,
    // 30 days is the statutory fallback across the EU and UK when a contract
    // says nothing, and 60 is the outer limit for business-to-business terms.
    // Stating a term is the whole point of the rule, so the default is well
    // inside that: 14 days is common freelance practice and short enough to
    // matter without being the kind of number a finance department refuses.
    value: { key: "paymentDays", fallback: 14, min: 1, max: 60 },
    // 25% to 50% up front is the range in general use, with 50% the norm on
    // smaller projects and for clients with no history.
    extra: { key: "depositPercent", fallback: 50, min: 0, max: 100 },
  },
  {
    key: "revisionRounds",
    severity: "blocking",
    checkable: true,
    // Two is the standard across design, writing and most creative work. One
    // is usual for development, three where several people review.
    value: { key: "revisionRounds", fallback: 2, min: 0, max: 10 },
  },
  { key: "assumptions", severity: "blocking", checkable: true },
  { key: "scopeChanges", severity: "suggestion", checkable: true },
  {
    key: "unpaidStretch",
    severity: "suggestion",
    checkable: true,
    // No external norm for this one. It is a question about what a person can
    // afford to be owed, so the figure is theirs from the start.
    value: { key: "maxUnpaidHours", fallback: 10, min: 1, max: 200 },
  },
  {
    key: "feedbackWindow",
    severity: "suggestion",
    checkable: true,
    // Three business days is the most commonly cited figure, inside a general
    // range of two to five.
    value: { key: "feedbackDays", fallback: 3, min: 1, max: 30 },
  },
  {
    key: "deemedAcceptance",
    severity: "suggestion",
    checkable: true,
    // Five to fourteen business days is the range in general use. Ten sits in
    // the middle and is long enough that nobody can call it a trap.
    value: { key: "acceptanceDays", fallback: 10, min: 1, max: 60 },
  },
  { key: "cancellation", severity: "suggestion", checkable: true },
  { key: "ownership", severity: "suggestion", checkable: true },
  { key: "exclusions", severity: "suggestion", checkable: true },
  /**
   * Every line on the deliverables list is a thing, not a happening.
   *
   * A quote listed "Design review session" and "Feedback-incorporated final
   * files" as deliverables seven and nine, and the client asked whether that
   * was one round of revisions or two. Promising something conditional on the
   * client responding, as though it were an item being bought, is the mistake.
   */
  { key: "deliverablesAreThings", severity: "suggestion", checkable: true },
  {
    key: "includedCalls",
    severity: "suggestion",
    checkable: true,
    // No researched norm. Two covers a kickoff and one alignment session,
    // which is the shape most small projects actually take.
    value: { key: "callsIncluded", fallback: 2, min: 0, max: 20 },
  },
  { key: "beforeSignature", severity: "suggestion", checkable: false },
  { key: "noNumberBeforeScope", severity: "suggestion", checkable: false },
];

export function ruleOf(key: string): GroundRule | undefined {
  return GROUND_RULES.find((rule) => rule.key === key);
}

/** What an account has changed about the starter set. */
export interface RuleSettings {
  /** Rules switched off. Everything not listed is on. */
  off: RuleKey[];
  /** Figures changed from the researched default. Everything else falls back. */
  values: Partial<Record<ValueKey, number>>;
}

export const DEFAULT_RULE_SETTINGS: RuleSettings = { off: [], values: {} };

/** Every figure the rules state, defaults filled in. */
export function ruleValues(settings: RuleSettings): Record<ValueKey, number> {
  const out = {} as Record<ValueKey, number>;
  for (const rule of GROUND_RULES) {
    for (const value of [rule.value, rule.extra]) {
      if (!value) continue;
      const set = settings.values[value.key];
      out[value.key] =
        typeof set === "number" && set >= value.min && set <= value.max ? set : value.fallback;
    }
  }
  return out;
}

/** One figure, defaulted and bounded. */
export function valueOf(settings: RuleSettings, key: ValueKey): number {
  return ruleValues(settings)[key];
}

function isRuleKey(value: unknown): value is RuleKey {
  return typeof value === "string" && GROUND_RULES.some((rule) => rule.key === value);
}

function valueSpec(key: string): RuleValue | undefined {
  for (const rule of GROUND_RULES) {
    if (rule.value?.key === key) return rule.value;
    if (rule.extra?.key === key) return rule.extra;
  }
  return undefined;
}

/**
 * Reads the settings off an account, defensively.
 *
 * Also carries forward the shape this had before the figures existed, when
 * the only number was the unpaid stretch and it sat at the top level. An
 * account that set it then keeps it now.
 */
export function parseRuleSettings(value: unknown): RuleSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_RULE_SETTINGS;
  const raw = value as { off?: unknown; values?: unknown; maxUnpaidHours?: unknown };

  const values: Partial<Record<ValueKey, number>> = {};
  const stored =
    raw.values && typeof raw.values === "object" && !Array.isArray(raw.values)
      ? (raw.values as Record<string, unknown>)
      : {};
  for (const [key, entry] of Object.entries(stored)) {
    const spec = valueSpec(key);
    if (!spec) continue;
    if (typeof entry !== "number" || !Number.isFinite(entry)) continue;
    values[spec.key] = Math.min(Math.max(Math.round(entry), spec.min), spec.max);
  }
  if (values.maxUnpaidHours === undefined && typeof raw.maxUnpaidHours === "number") {
    const spec = valueSpec("maxUnpaidHours");
    if (spec && Number.isFinite(raw.maxUnpaidHours)) {
      values.maxUnpaidHours = Math.min(
        Math.max(Math.round(raw.maxUnpaidHours), spec.min),
        spec.max
      );
    }
  }

  return {
    off: Array.isArray(raw.off) ? raw.off.filter(isRuleKey) : [],
    values,
  };
}

/** The quote, in the shape the checks need. */
export interface CheckableQuote {
  extras?: BriefExtras | null;
  hours: number;
  price: number;
  rateUnit?: string | null;
  /** "FIXED_TOTAL" or "HOURLY_TRACKED". See lib/quote-definitions. */
  billing?: string | null;
  /**
   * How much armour this quote was written with. See lib/protection.
   *
   * A quote for a client of two years is not missing a cancellation clause,
   * it was written without one on purpose. Checking it against the full set
   * would be Freely arguing with an answer it asked for.
   */
  protection?: string | null;
  /**
   * The payment plan this quote was written on.
   *
   * Rules read it, because several of them stop meaning anything once it is
   * decided. A freelancer paid in full before starting is not waiting on an
   * approval and is not carrying unpaid work, so flagging either at them is
   * Freely arguing with a choice it was told about.
   */
  paymentPlan?: string | null;
  milestoneCount: number;
  /** Sections the freelancer removed. A removed section is not a present one. */
  hidden?: string[];
  /** The deliverables as written, for checking they are things. */
  deliverables?: string[];
}

/** Whether some text names an actual number of anything. */
function statesANumber(text: string): boolean {
  if (/\d/.test(text)) return true;
  // Spelled out, which models do as often as not, and in both languages.
  return /\b(one|two|three|four|five|six|un|una|dos|tres|cuatro|cinco|seis)\b/i.test(text);
}

/** Phrases that look like a policy and commit to nothing. */
const VAGUE = [
  "within reason",
  "as needed",
  "as required",
  "reasonable amends",
  "reasonable number",
  "unlimited",
  "dentro de lo razonable",
  "las que hagan falta",
  "ilimitadas",
];

function isVague(text: string): boolean {
  const lower = text.toLowerCase();
  return VAGUE.some((phrase) => lower.includes(phrase));
}

function mentions(text: string | undefined, words: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function present(quote: CheckableQuote, section: string): boolean {
  return !(quote.hidden ?? []).includes(section);
}

/**
 * Which rules this quote breaks.
 *
 * A check that cannot tell either way returns satisfied. Flagging on a
 * maybe teaches people to click through flags, which costs more than the
 * occasional miss.
 */
export function brokenRules(quote: CheckableQuote, settings: RuleSettings): GroundRule[] {
  const extras = quote.extras ?? {};
  const off = new Set(settings.off);
  const broken: GroundRule[] = [];

  /**
   * Paid in full before the work starts.
   *
   * The strongest position there is, and several rules exist only to protect
   * somebody who is not in it. A rule that fires anyway is not being careful,
   * it is overriding a decision it was told about, and the way that reads is
   * that the choice did not matter.
   */
  const paidUpFront = quote.paymentPlan === "UPFRONT";

  /**
   * Only the rules this quote's protection level asked for.
   *
   * Without this, a quote written for somebody they have worked with for two
   * years comes back with eight flags for clauses that were deliberately left
   * out. The level is the answer; the flags check the quote against the
   * answer, not against the maximum.
   */
  const asked = isProtectionLevel(quote.protection)
    ? new Set<string>(protectionFor(quote.protection).rules)
    : null;

  const fails: Record<RuleKey, () => boolean> = {
    // Nothing on the quote says when money moves, so the client will decide
    // for themselves and they will decide late.
    paymentBasis: () => !(extras.paymentTerms && present(quote, "paymentTerms")),

    // A revisions policy that does not say how many is not a policy. The
    // absence of the section is fine: plenty of work does not attract rounds.
    revisionRounds: () => {
      const text = present(quote, "revisions") ? extras.revisions : undefined;
      if (!text) return false;
      return isVague(text) || !statesANumber(text);
    },

    // Nothing states what the price rests on, so an overrun is the
    // freelancer's mistake rather than a changed circumstance.
    assumptions: () => !(extras.assumptions?.length && present(quote, "assumptions")),

    scopeChanges: () => !(extras.scopeChanges?.length && present(quote, "scopeChanges")),

    // The whole job is one payment at the end, and it is a long one.
    unpaidStretch: () => {
      // Nothing is owed to somebody who has already been paid.
      if (paidUpFront) return false;
      if (quote.hours <= 0) return false;
      if (quote.milestoneCount > 1) return false;
      // An up-front deposit means the unpaid stretch is not the whole job.
      if (mentions(extras.paymentTerms, ["up front", "upfront", "deposit", "por adelantado", "anticipo"])) {
        return false;
      }
      return quote.hours > valueOf(settings, "maxUnpaidHours");
    },

    // The date rests on the client coming back, and the document does not
    // say so, so every delay lands on the freelancer's end date.
    feedbackWindow: () =>
      !mentions(
        `${extras.paymentTerms ?? ""} ${extras.revisions ?? ""} ${extras.terms?.cancellation ?? ""} ${(extras.scopeChanges ?? []).join(" ")}`,
        ["business day", "working day", "days of", "día hábil", "días hábiles", "plazo"]
      ),

    // Silence on a delivered milestone leaves the freelancer waiting, unpaid,
    // with nothing to point at.
    // An approval that never comes costs nothing when the money is already in.
    deemedAcceptance: () =>
      !paidUpFront &&
      !mentions(`${extras.paymentTerms ?? ""} ${extras.terms?.cancellation ?? ""}`, [
        "accepted",
        "acceptance",
        "no response",
        "aceptado",
        "aceptación",
      ]),

    cancellation: () => !(extras.terms?.cancellation && present(quote, "terms")),
    ownership: () => !(extras.terms?.ownership && present(quote, "terms")),

    // The work next door to the work: answering someone's developers, testing
    // what got built, writing the copy, sorting out access. It gets assumed in
    // by everyone and quoted by no one.
    exclusions: () => {
      const said = `${(extras.scopeChanges ?? []).join(" ")} ${(extras.assumptions ?? []).join(" ")}`;
      return !mentions(said, ["not included", "excluded", "separately", "no incluye", "aparte"]);
    },

    // How many calls are included, stated as a number rather than left to
    // "a couple". Every one after them is either billed or resented.
    includedCalls: () =>
      !mentions(`${extras.paymentTerms ?? ""} ${(extras.assumptions ?? []).join(" ")} ${(extras.scopeChanges ?? []).join(" ")}`, [
        "call",
        "meeting",
        "session",
        "llamada",
        "reunión",
      ]),

    // A line that only happens if the client responds cannot be a thing they
    // are buying: there may be no response, and then there is nothing to hand
    // over. See lib/deliverable-check.
    deliverablesAreThings: () => happenings(quote.deliverables ?? []).length > 0,

    beforeSignature: () => false,
    noNumberBeforeScope: () => false,
  };

  for (const rule of GROUND_RULES) {
    if (off.has(rule.key)) continue;
    if (!rule.checkable) continue;
    if (asked && !asked.has(rule.key)) continue;
    if (fails[rule.key]()) broken.push(rule);
  }
  return broken;
}

/** The blocking ones among them, which is what publishing waits on. */
export function blockingRules(broken: GroundRule[]): GroundRule[] {
  return broken.filter((rule) => rule.severity === "blocking");
}
