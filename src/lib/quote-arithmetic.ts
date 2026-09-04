import { priceFor, unitsFromHours, type RateUnit } from "@/lib/rate-unit";

/**
 * Making the numbers on a quote agree with each other.
 *
 * The prompt tells the model the rate is fixed, that its only real decision is
 * the hours, and that price is hours times rate. Then nothing checked. So a
 * quote could go out saying £50 an hour, 13 hours, and £900, and the only
 * person who would notice is the client, doing the multiplication a freelancer
 * asked them to trust.
 *
 * This is not a judgement call about the price. The rate is the freelancer's
 * own figure and the hours are the model's estimate: given both, the total is
 * arithmetic, and arithmetic is not something to leave to a language model.
 *
 * Fixed-price quotes are left entirely alone. There the total is the agreed
 * thing and the hours are context, so there is nothing to reconcile.
 */

export interface Numbers {
  price: number;
  hours: number;
}

export interface Reconciled extends Numbers {
  /** What the model said, when it did not match. */
  saidPrice: number | null;
}

/**
 * The price the stated rate and hours actually produce.
 *
 * Returns the quote's own numbers untouched when there is no rate to check
 * against, when it is a fixed price, or when the model got it right, which is
 * most of the time.
 */
export function reconcilePrice(
  numbers: Numbers,
  rate: number | null | undefined,
  unit: RateUnit
): Reconciled {
  const untouched: Reconciled = { ...numbers, saidPrice: null };

  // No rate to multiply, or a fixed price where the total is the agreed thing.
  if (!rate || rate <= 0 || unit === "FIXED") return untouched;
  if (!Number.isFinite(numbers.hours) || numbers.hours <= 0) return untouched;

  const correct = priceFor(numbers.hours, rate, unit);
  if (correct <= 0) return untouched;

  /**
   * A pound or two of rounding is not a mistake.
   *
   * Day rates convert through a working day and land on a tenth of a day, so
   * an exact match is not always available and correcting by a rounding error
   * would flag every day-rate quote as wrong.
   */
  if (Math.abs(correct - numbers.price) <= 2) return untouched;

  return { price: correct, hours: numbers.hours, saidPrice: numbers.price };
}

/**
 * Whether the hours and the timeline can both be true.
 *
 * Not corrected, only reported: a fortnight of calendar time can hold six
 * hours of work or sixty, and only the freelancer knows whether this one is
 * part-time. What is worth saying is when the two are impossible together,
 * which usually means the model wrote a timeline for a different job.
 */
export function impossibleSchedule(
  hours: number,
  weeks: number,
  unit: RateUnit
): "tooMuch" | "tooLittle" | null {
  if (weeks <= 0 || hours <= 0) return null;
  const units = unitsFromHours(hours, unit);
  const perWeek = (unit === "DAY" ? units * 8 : units) / weeks;

  // More than a full week of work, every week, for the whole run.
  if (perWeek > 45) return "tooMuch";
  // Less than half a day a week: the timeline is describing waiting rather
  // than working, and it will read to a client as the job taking that long.
  if (perWeek < 4) return "tooLittle";
  return null;
}
