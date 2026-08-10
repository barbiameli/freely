/**
 * Hourly or daily pricing.
 *
 * Plenty of freelancers quote in days. Making them convert to an hourly
 * figure means inventing a day length, and then the quote shows a rate they
 * never quoted at. The unit is stored alongside the rate and everything
 * downstream reads both.
 *
 * Hours remain the underlying estimate in either case, because that is what
 * the model reasons in and what past quotes are compared on. A day rate is
 * converted at the length below only where an hours figure is genuinely
 * needed, and never shown as an hourly price.
 */
export type RateUnit = "HOUR" | "DAY";

/** A working day. Used only to translate between an estimate in hours and a
 * price in days, never to present a day rate as an hourly one. */
export const HOURS_PER_DAY = 8;

export function parseRateUnit(value?: string | null): RateUnit {
  return value === "DAY" ? "DAY" : "HOUR";
}

export function rateSuffix(unit: RateUnit): string {
  return unit === "DAY" ? "/day" : "/hr";
}

export function unitNoun(unit: RateUnit, plural = false): string {
  if (unit === "DAY") return plural ? "days" : "day";
  return plural ? "hours" : "hour";
}

/** How many billable units an estimate in hours comes to. */
export function unitsFromHours(hours: number, unit: RateUnit): number {
  if (unit !== "DAY") return hours;
  return Math.round((hours / HOURS_PER_DAY) * 10) / 10;
}

/** The hours an estimate in billable units represents. */
export function hoursFromUnits(units: number, unit: RateUnit): number {
  return unit === "DAY" ? units * HOURS_PER_DAY : units;
}

/** What the work costs. The rate is per unit, so days are priced in days. */
export function priceFor(hours: number, rate: number, unit: RateUnit): number {
  if (rate <= 0 || hours <= 0) return 0;
  return Math.round(unitsFromHours(hours, unit) * rate);
}

/** How the estimate reads on the quote: "155 hours" or "19.5 days". */
export function describeEffort(hours: number, unit: RateUnit): string {
  const units = unitsFromHours(hours, unit);
  return `${units} ${unitNoun(unit, units !== 1)}`;
}
