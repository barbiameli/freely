/**
 * Keeping hours and price in step when a quote is edited by hand.
 *
 * The two were independent fields: change the estimate from 40 hours to 60 and
 * the total sat there at the old number, so a quote could go out saying 60
 * hours at a total that worked out to a different rate than the one it was
 * built on.
 *
 * The rate is the thing that stays fixed (see applyHourlyRate, which enforces
 * the same rule at generation), so changing the hours moves the price.
 * Changing the price directly is left alone: rounding a total to something
 * sendable is a normal thing to do, and silently rewriting the hours
 * underneath would be worse than the drift.
 */
import { priceFor, unitsFromHours, type RateUnit } from "@/lib/rate-unit";

export interface Repriced {
  hours: number;
  price: number;
  /** The rate used, for showing what happened. */
  rate: number;
}

/**
 * The rate a quote is running at.
 *
 * Prefers the rate it was built with. Older quotes predate that column, so
 * the rate implied by the numbers themselves is the next best thing, and it
 * is exactly the rate the client is being shown either way.
 */
export function effectiveRate(
  previousPrice: number,
  previousHours: number,
  storedRate?: number | null,
  unit: RateUnit = "HOUR"
): number {
  if (storedRate && storedRate > 0) return storedRate;
  const units = unitsFromHours(previousHours, unit);
  if (units > 0 && previousPrice > 0) return previousPrice / units;
  return 0;
}

/**
 * Works out the new price when the hours change.
 *
 * Returns null when there is no rate to work from, in which case the price is
 * left alone rather than guessed at.
 */
export function repriceForHours(
  nextHours: number,
  previousPrice: number,
  previousHours: number,
  storedRate?: number | null,
  unit: RateUnit = "HOUR"
): Repriced | null {
  if (!Number.isFinite(nextHours) || nextHours < 0) return null;
  const rate = effectiveRate(previousPrice, previousHours, storedRate, unit);
  if (rate <= 0) return null;
  if (nextHours === previousHours) return null;
  return { hours: nextHours, price: priceFor(nextHours, rate, unit), rate };
}
