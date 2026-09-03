import type { Dictionary } from "@/lib/i18n";
import type { RuleKey } from "@/lib/ground-rules";

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
}

export function ruleWords(key: RuleKey, t: Dictionary): RuleWords {
  const r = t.rules;
  switch (key) {
    case "paymentBasis":
      return { title: r.paymentBasisTitle, why: r.paymentBasisWhy, cost: r.paymentBasisCost };
    case "revisionRounds":
      return { title: r.revisionRoundsTitle, why: r.revisionRoundsWhy, cost: r.revisionRoundsCost };
    case "assumptions":
      return { title: r.assumptionsTitle, why: r.assumptionsWhy, cost: r.assumptionsCost };
    case "scopeChanges":
      return { title: r.scopeChangesTitle, why: r.scopeChangesWhy, cost: r.scopeChangesCost };
    case "unpaidStretch":
      return { title: r.unpaidStretchTitle, why: r.unpaidStretchWhy, cost: r.unpaidStretchCost };
    case "feedbackWindow":
      return { title: r.feedbackWindowTitle, why: r.feedbackWindowWhy, cost: r.feedbackWindowCost };
    case "deemedAcceptance":
      return {
        title: r.deemedAcceptanceTitle,
        why: r.deemedAcceptanceWhy,
        cost: r.deemedAcceptanceCost,
      };
    case "cancellation":
      return { title: r.cancellationTitle, why: r.cancellationWhy, cost: r.cancellationCost };
    case "ownership":
      return { title: r.ownershipTitle, why: r.ownershipWhy, cost: r.ownershipCost };
    case "exclusions":
      return { title: r.exclusionsTitle, why: r.exclusionsWhy, cost: r.exclusionsCost };
    case "beforeSignature":
      return {
        title: r.beforeSignatureTitle,
        why: r.beforeSignatureWhy,
        cost: r.beforeSignatureCost,
      };
    case "noNumberBeforeScope":
      return {
        title: r.noNumberBeforeScopeTitle,
        why: r.noNumberBeforeScopeWhy,
        cost: r.noNumberBeforeScopeCost,
      };
  }
}
