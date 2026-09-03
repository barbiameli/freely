import type { BriefExtras } from "@/lib/anthropic";

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
  | "beforeSignature"
  | "noNumberBeforeScope";

export interface GroundRule {
  key: RuleKey;
  severity: Severity;
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
  { key: "paymentBasis", severity: "blocking", checkable: true },
  { key: "revisionRounds", severity: "blocking", checkable: true },
  { key: "assumptions", severity: "blocking", checkable: true },
  { key: "scopeChanges", severity: "suggestion", checkable: true },
  { key: "unpaidStretch", severity: "suggestion", checkable: true },
  { key: "feedbackWindow", severity: "suggestion", checkable: true },
  { key: "deemedAcceptance", severity: "suggestion", checkable: true },
  { key: "cancellation", severity: "suggestion", checkable: true },
  { key: "ownership", severity: "suggestion", checkable: true },
  { key: "exclusions", severity: "suggestion", checkable: true },
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
  /**
   * The longest stretch of unpaid work, in hours, before the rule complains.
   *
   * A number rather than a rule of thumb, because the point of it is to be
   * checkable. At a typical rate this is the most somebody is ever out of
   * pocket, and it is the one figure worth setting per account: it depends
   * entirely on what a person can afford to be owed.
   */
  maxUnpaidHours: number;
}

export const DEFAULT_RULE_SETTINGS: RuleSettings = { off: [], maxUnpaidHours: 10 };

function isRuleKey(value: unknown): value is RuleKey {
  return typeof value === "string" && GROUND_RULES.some((rule) => rule.key === value);
}

/** Reads the settings off an account, defensively. */
export function parseRuleSettings(value: unknown): RuleSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_RULE_SETTINGS;
  const raw = value as { off?: unknown; maxUnpaidHours?: unknown };
  const hours = typeof raw.maxUnpaidHours === "number" && raw.maxUnpaidHours > 0
    ? Math.min(raw.maxUnpaidHours, 200)
    : DEFAULT_RULE_SETTINGS.maxUnpaidHours;
  return {
    off: Array.isArray(raw.off) ? raw.off.filter(isRuleKey) : [],
    maxUnpaidHours: hours,
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
  milestoneCount: number;
  /** Sections the freelancer removed. A removed section is not a present one. */
  hidden?: string[];
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
      if (quote.hours <= 0) return false;
      if (quote.milestoneCount > 1) return false;
      // An up-front deposit means the unpaid stretch is not the whole job.
      if (mentions(extras.paymentTerms, ["up front", "upfront", "deposit", "por adelantado", "anticipo"])) {
        return false;
      }
      return quote.hours > settings.maxUnpaidHours;
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
    deemedAcceptance: () =>
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

    beforeSignature: () => false,
    noNumberBeforeScope: () => false,
  };

  for (const rule of GROUND_RULES) {
    if (off.has(rule.key)) continue;
    if (!rule.checkable) continue;
    if (fails[rule.key]()) broken.push(rule);
  }
  return broken;
}

/** The blocking ones among them, which is what publishing waits on. */
export function blockingRules(broken: GroundRule[]): GroundRule[] {
  return broken.filter((rule) => rule.severity === "blocking");
}
