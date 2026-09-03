import type { Dictionary } from "@/lib/i18n";
import type { RuleKey, ValueKey } from "@/lib/ground-rules";

/**
 * A rule's name, its reasoning and what it costs, in the reader's language.
 *
 * Kept apart from lib/ground-rules so the rules themselves stay pure and
 * testable: a check that imports a dictionary is a check that cannot be run
 * without one. One switch rather than three keys built by string concatenation,
 * because a missing translation should be a compile error and not an
 * "undefined" printed on somebody's page.
 */
export interface RuleWords {
  title: string;
  why: string;
  cost: string;
  /**
   * The rule as it will actually be applied, numbers and all.
   *
   * Kept with its placeholders rather than filled in here, so the page can
   * split on them and put an editable field where each figure goes. A rule you
   * can read as a sentence and change a number inside is a rule somebody
   * understands; the same rule as a title above a numeric input is a setting.
   */
  statement: string;
}

export function ruleWords(key: RuleKey, t: Dictionary): RuleWords {
  const r = t.rules;
  switch (key) {
    case "paymentBasis":
      return { title: r.paymentBasisTitle, why: r.paymentBasisWhy, cost: r.paymentBasisCost, statement: r.paymentBasisRule };
    case "revisionRounds":
      return { title: r.revisionRoundsTitle, why: r.revisionRoundsWhy, cost: r.revisionRoundsCost, statement: r.revisionRoundsRule };
    case "assumptions":
      return { title: r.assumptionsTitle, why: r.assumptionsWhy, cost: r.assumptionsCost, statement: r.assumptionsRule };
    case "scopeChanges":
      return { title: r.scopeChangesTitle, why: r.scopeChangesWhy, cost: r.scopeChangesCost, statement: r.scopeChangesRule };
    case "unpaidStretch":
      return { title: r.unpaidStretchTitle, why: r.unpaidStretchWhy, cost: r.unpaidStretchCost, statement: r.unpaidStretchRule };
    case "feedbackWindow":
      return { title: r.feedbackWindowTitle, why: r.feedbackWindowWhy, cost: r.feedbackWindowCost, statement: r.feedbackWindowRule };
    case "deemedAcceptance":
      return {
        title: r.deemedAcceptanceTitle,
        why: r.deemedAcceptanceWhy,
        cost: r.deemedAcceptanceCost,
        statement: r.deemedAcceptanceRule,
      };
    case "cancellation":
      return { title: r.cancellationTitle, why: r.cancellationWhy, cost: r.cancellationCost, statement: r.cancellationRule };
    case "ownership":
      return { title: r.ownershipTitle, why: r.ownershipWhy, cost: r.ownershipCost, statement: r.ownershipRule };
    case "includedCalls":
      return {
        title: r.includedCallsTitle,
        why: r.includedCallsWhy,
        cost: r.includedCallsCost,
        statement: r.includedCallsRule,
      };
    case "exclusions":
      return { title: r.exclusionsTitle, why: r.exclusionsWhy, cost: r.exclusionsCost, statement: r.exclusionsRule };
    case "beforeSignature":
      return {
        title: r.beforeSignatureTitle,
        why: r.beforeSignatureWhy,
        cost: r.beforeSignatureCost,
        statement: r.beforeSignatureRule,
      };
    case "noNumberBeforeScope":
      return {
        title: r.noNumberBeforeScopeTitle,
        why: r.noNumberBeforeScopeWhy,
        cost: r.noNumberBeforeScopeCost,
        statement: r.noNumberBeforeScopeRule,
      };
  }
}

/** What one figure is, for the field that edits it inside a sentence. */
export function valueLabel(key: ValueKey, t: Dictionary): string {
  switch (key) {
    case "paymentDays":
      return t.rules.valuePaymentDays;
    case "depositPercent":
      return t.rules.valueDepositPercent;
    case "revisionRounds":
      return t.rules.valueRevisionRounds;
    case "feedbackDays":
      return t.rules.valueFeedbackDays;
    case "acceptanceDays":
      return t.rules.valueAcceptanceDays;
    case "callsIncluded":
      return t.rules.valueCallsIncluded;
    case "maxUnpaidHours":
      return t.rules.valueMaxUnpaidHours;
  }
}

/**
 * The fix, as an instruction the model can carry out.
 *
 * A flag that only names a problem leaves the freelancer to write the clause
 * themselves, which is the work they opened Freely to avoid. So each rule
 * knows how to repair the quote it is complaining about: the figures come from
 * the account's own settings, and the model writes the sentence in the voice
 * the rest of the quote is already in.
 *
 * Written in English regardless of the reader's language. This is an
 * instruction to a model rather than copy for a person, and the quote's own
 * language is carried separately by the refine context.
 */
export function ruleFix(key: RuleKey, values: Record<ValueKey, number>): string {
  switch (key) {
    case "paymentBasis":
      return `Add payment terms saying when money is due: ${values.depositPercent}% before the work starts for a new client, the rest invoiced on delivery, and every invoice due within ${values.paymentDays} days. Keep it to one or two plain sentences and do not include any bank or card details.`;
    case "revisionRounds":
      return `Rewrite the revisions policy so it states exactly ${values.revisionRounds} rounds of changes, says which stages they apply to, and says that further rounds are quoted and approved before they start. Never leave the count open with a phrase like "within reason".`;
    case "assumptions":
      return "Add an assumptions list: 4 to 8 short lines naming the quantities, existing material and client-supplied inputs this price rests on, drawn from the brief. End with a line saying that if any of them turns out differently you will flag it and agree a revised scope before continuing.";
    case "scopeChanges":
      return "Add a list of what would change the price or the date on this project, 4 to 8 short lines drawn from this brief rather than a generic list.";
    case "unpaidStretch":
      return `This project is long enough that a single payment at the end would leave more than ${values.maxUnpaidHours} hours of work unpaid. Break the payment into milestones, each invoiced when it is delivered.`;
    case "feedbackWindow":
      return `Say that feedback and sign-off come back within ${values.feedbackDays} business days, and that the delivery date moves by the same number of days when they do not.`;
    case "deemedAcceptance":
      return `Add to the payment terms that delivered work with no response after ${values.acceptanceDays} business days counts as accepted and is invoiced.`;
    case "cancellation":
      return "Add a cancellation clause: completed work is invoiced, the part in progress is invoiced in full, and anything not started is not charged.";
    case "ownership":
      return "Add an ownership clause: rights to the final deliverables transfer on final payment rather than on delivery, and working files and unused concepts stay with the freelancer unless separately agreed.";
    case "exclusions":
      return "Name the work adjacent to this job that is not included, drawn from this brief, and say plainly that it is quoted separately.";
    case "includedCalls":
      return `Say that ${values.callsIncluded} calls are included and that any beyond them are billed at the stated rate.`;
    case "beforeSignature":
    case "noNumberBeforeScope":
      // Rules about what somebody does before they open Freely at all. There
      // is nothing on the quote to repair.
      return "";
  }
}
