/**
 * Whether a payment paragraph argues with itself.
 *
 * A real quote went out saying, in consecutive sentences, "if the project
 * comes in under 13 hours, you pay only for the hours worked" and "the full
 * amount is invoiced on delivery". It also offered a ceiling, which this app
 * deliberately does not do, and it promised that "the next milestone starts"
 * on a quote paid in a single sum whose stages were the shape of the work.
 *
 * Every one of those came from a refine that rewrote the terms without being
 * told the basis. That is fixed at the source. This is the net underneath it,
 * because a model told not to do something still does it occasionally and the
 * freelancer is the one who sends the result.
 *
 * Word lists rather than a model call: this runs on every render of the quote
 * page, and a check that costs a second and a token budget is a check that
 * gets moved somewhere it is not run.
 */
import type { BillingBasis } from "@/lib/quote-definitions";

/** Saying the whole number is owed regardless of the hours. */
const WHOLE_AMOUNT = [
  "full amount",
  "the total is invoiced",
  "total is invoiced",
  "the balance is invoiced",
  "entire amount",
  "importe total",
  "el total se factura",
];

/** Saying only the hours actually worked are owed. */
const ONLY_HOURS = [
  "only for the hours",
  "hours actually worked",
  "hours worked",
  "horas realmente trabajadas",
  "solo las horas",
];

/** A cap on an estimate, which leaves the overrun with the freelancer. */
const CEILING = [
  "ceiling of",
  "capped at",
  "a cap of",
  "maximum of",
  "not to exceed",
  "no exceder",
  "tope de",
  "máximo de",
];

/** Invoicing a stage. */
const PER_MILESTONE = [
  "milestone is invoiced",
  "invoiced for the hours worked to that point",
  "next milestone starts",
  "each milestone is invoiced",
  "hito se factura",
  "siguiente hito",
];

export type PaymentProblem =
  /** Says the whole amount is due and also that only the hours are. */
  | "bothAmounts"
  /** Caps an estimate, so the overrun is unpaid and the upside is gone. */
  | "ceilingOnEstimate"
  /** Invoices a stage on a quote whose stages are not payment points. */
  | "milestoneWithoutMilestones";

function says(text: string, phrases: string[]): boolean {
  const lower = text.toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase));
}

export function paymentProblems(
  text: string | undefined | null,
  options: { billing: BillingBasis; milestonesBillable: boolean; fixedPrice: boolean }
): PaymentProblem[] {
  if (!text || !text.trim()) return [];
  const found: PaymentProblem[] = [];

  // Only meaningful where the total is an estimate. On a fixed total the whole
  // amount genuinely is what is owed, and saying so is correct.
  if (options.billing === "HOURLY_TRACKED" && !options.fixedPrice) {
    if (says(text, WHOLE_AMOUNT) && says(text, ONLY_HOURS)) found.push("bothAmounts");
    if (says(text, CEILING)) found.push("ceilingOnEstimate");
  }

  if (!options.milestonesBillable && says(text, PER_MILESTONE)) {
    found.push("milestoneWithoutMilestones");
  }

  return found;
}
