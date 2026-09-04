import type { RuleKey } from "@/lib/ground-rules";
import type { SectionKey } from "@/lib/quote-defaults";
import type { PaymentPlan } from "@/lib/quote-defaults";

/**
 * How much armour this quote carries, chosen once, at the start.
 *
 * The rules used to arrive as a list of things the finished quote was missing,
 * which is a scolding: five panels telling somebody what is wrong with a quote
 * they have just written. It was also the same five panels for a client of two
 * years and a stranger from the internet, which is the part that made it read
 * as noise. Nobody wants the same protection in both cases.
 *
 * So it is one question, asked before anything is written, about the thing a
 * freelancer is already judging in their head: how well do you know these
 * people. The answer decides which clauses the quote carries and, at the top
 * level, how the money is structured.
 *
 * The money matters more than the wording. A cancellation clause records what
 * happens; milestones and a deposit are what actually stop somebody carrying a
 * project they are never paid for. A protection level that only added
 * paragraphs would be the weaker half of the idea.
 */
export type ProtectionLevel = "KNOWN" | "NEW" | "GUARDED";

export const PROTECTION_LEVELS: ProtectionLevel[] = ["KNOWN", "NEW", "GUARDED"];

export function isProtectionLevel(value: unknown): value is ProtectionLevel {
  return typeof value === "string" && (PROTECTION_LEVELS as string[]).includes(value);
}

/** What a level asks the quote to carry, and what it does to the money. */
export interface Protection {
  /** The ground rules that apply at this level. */
  rules: RuleKey[];
  /** Sections the quote should carry. */
  sections: SectionKey[];
  /**
   * A payment plan this level insists on, or nothing to leave the choice
   * alone. Only the top level overrides, and only because that is the level
   * somebody picks when they are worried about being paid.
   */
  paymentPlan?: PaymentPlan;
  /** Whether to open with a short paid piece of work that produces the scope. */
  paidDiscovery: boolean;
}

/**
 * Worked together before.
 *
 * The essentials and nothing else. A client who has paid you three times does
 * not need to be told what a cancellation costs, and sending them a page of
 * clauses is a change in tone they will notice.
 */
const KNOWN: Protection = {
  // Even here: a deliverables list that promises a review session is confusing
  // to somebody who trusts you, not only to somebody who does not.
  rules: ["paymentBasis", "revisionRounds", "deliverablesAreThings"],
  sections: ["includeSOW", "includeRevisions"],
  paidDiscovery: false,
};

/**
 * A new client, which is the ordinary case.
 *
 * Everything that costs a freelancer money when it is missing, and nothing
 * that implies you expect trouble. This is the set that would have covered
 * every problem in the projects this feature was built from.
 */
const NEW: Protection = {
  rules: [
    "paymentBasis",
    "revisionRounds",
    "deliverablesAreThings",
    "assumptions",
    "scopeChanges",
    "cancellation",
    "ownership",
    "deemedAcceptance",
    "includedCalls",
  ],
  sections: [
    "includeSOW",
    "includeRevisions",
    "includeAssumptions",
    "includeScopeChanges",
    "includeTerms",
  ],
  paidDiscovery: false,
};

/**
 * Something feels off.
 *
 * Everything, and the money restructured underneath it. Milestones rather than
 * one payment at the end, so the most you are ever owed is one chunk of work,
 * and an opening piece of paid discovery when the job cannot be priced without
 * seeing something nobody has shown you yet.
 *
 * This is the level that answers the actual question a freelancer has when
 * they hesitate over a client, which is not "what clauses should I add" but
 * "how do I not get burned".
 */
const GUARDED: Protection = {
  rules: [
    "paymentBasis",
    "revisionRounds",
    "deliverablesAreThings",
    "assumptions",
    "scopeChanges",
    "cancellation",
    "ownership",
    "deemedAcceptance",
    "includedCalls",
    "exclusions",
    "feedbackWindow",
    "unpaidStretch",
  ],
  sections: [
    "includeSOW",
    "includeRevisions",
    "includeAssumptions",
    "includeScopeChanges",
    "includeTerms",
    "includeTimeline",
  ],
  paymentPlan: "MILESTONE",
  paidDiscovery: true,
};

export function protectionFor(level: ProtectionLevel): Protection {
  if (level === "KNOWN") return KNOWN;
  if (level === "GUARDED") return GUARDED;
  return NEW;
}

/**
 * The instruction the top level adds.
 *
 * Paid discovery is the one piece of a freelancer's own playbook that has no
 * other home in the app: a short, fixed, paid first milestone whose deliverable
 * is the scope itself, deducted from the total if the client goes ahead. It
 * exists because the alternative, quoting a price for something nobody has
 * opened, is where most underestimates come from.
 *
 * Only ever suggested when the brief actually describes something unseen.
 * Proposing discovery for a job somebody has already scoped is padding.
 */
export function discoveryInstruction(hours: number, symbol: string, rate: number): string {
  const suggested = Math.max(2, Math.min(4, Math.round(hours * 0.2)));
  const fee = suggested * rate;
  return `Open with a short paid discovery milestone. It is ${suggested} hours at the stated rate, so ${symbol}${fee}, and its deliverable is the scope itself: going through the product or material, then a written breakdown, a fixed price for the rest of the work and a timeline. Say plainly that this fee comes off the total if the client goes ahead with the full project, and that if they do not, they keep the breakdown. The remaining milestones cover the work after it.`;
}

/** What a level asks the model for, in words. */
export function protectionInstruction(level: ProtectionLevel): string {
  if (level === "KNOWN") {
    return "This client and freelancer have worked together before. Keep the quote short and warm: the terms it needs and nothing more. Do not add clauses that read as guarding against them.";
  }
  if (level === "GUARDED") {
    return "The freelancer has reservations about this engagement. Write the quote so that at no point are they carrying a large amount of unpaid work: split the money into milestones, each invoiced when it is delivered, and make the boundaries the points where the client has to agree something before the work can carry on. Say clearly what happens if the project stalls or is cancelled. Keep the tone matter of fact throughout, never defensive: this reads as somebody who has run projects before, not somebody who expects to be cheated.";
  }
  return "This is a new client. Write the quote so both sides know what was agreed: what the price assumes, what would change it, what happens on cancellation, and who owns the work when. Keep the tone plain and unsuspicious.";
}
