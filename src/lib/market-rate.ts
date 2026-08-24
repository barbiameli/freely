/**
 * A researched rate, as numbers somebody can press.
 *
 * The research already produced a paragraph. A paragraph is the wrong shape for
 * this: it cannot fill a field, so somebody reading "typically £400 to £650 a
 * day" still has to decide, type, and wonder whether they read it right. The
 * same call can return the numbers, and then the answer is three chips.
 *
 * A range rather than one figure, deliberately. There is no single correct rate
 * for a senior designer in Britain, and printing one would be a confidence the
 * evidence does not support. Three points across a range says what is true:
 * here is the spread, where you sit in it is your call. It also makes the
 * decision small, which is the actual problem for somebody who does not know
 * what to charge.
 */
import type { ExpertiseLevel } from "@/lib/quote-defaults";

export const EXPERTISE_LEVELS: ExpertiseLevel[] = ["Junior", "Mid-level", "Senior", "Expert"];

/** The spread for one level, in whole units of the currency. */
export interface RateRange {
  low: number;
  high: number;
}

/** Every level, so one call answers for all four and the cache is shared. */
export type RateLevels = Record<ExpertiseLevel, RateRange>;

/**
 * The three numbers offered.
 *
 * Low, middle and high, with the middle as the midpoint rather than a
 * separately researched "typical". A third researched number would be a third
 * thing to be wrong about, and the midpoint of a range is the one value nobody
 * can dispute.
 *
 * Rounded to something a person would actually say. Nobody quotes £427 a day,
 * and a figure that precise implies a precision the research does not have.
 */
export function pickThree(range: RateRange): number[] {
  const low = Math.min(range.low, range.high);
  const high = Math.max(range.low, range.high);
  const middle = (low + high) / 2;
  const rounded = [low, middle, high].map((value) => roundToStep(value));
  // A narrow range can round all three to the same number, and three identical
  // chips is a choice that is not one.
  return Array.from(new Set(rounded)).sort((a, b) => a - b);
}

/**
 * To the nearest 5, 10 or 50, depending on size.
 *
 * The step grows with the number because the meaningful precision does. Five
 * pounds matters on an hourly rate and is noise on a fixed price.
 */
export function roundToStep(value: number): number {
  const step = value >= 1000 ? 50 : value >= 200 ? 10 : 5;
  return Math.max(step, Math.round(value / step) * step);
}

/**
 * Reads what the model returned, or gives up.
 *
 * A Json column holds whatever was written to it, and a model returns whatever
 * it feels like. Anything not shaped like four levels of two positive numbers
 * is refused rather than patched up: a half-parsed range would put an invented
 * number in front of somebody deciding what to charge, which is the one place
 * in Freely where being confidently wrong costs them money.
 */
export function parseLevels(value: unknown): RateLevels | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const levels = {} as RateLevels;

  for (const level of EXPERTISE_LEVELS) {
    const range = source[level];
    if (!range || typeof range !== "object") return null;
    const { low, high } = range as { low?: unknown; high?: unknown };
    if (!isRate(low) || !isRate(high)) return null;
    levels[level] = { low: Math.min(low, high), high: Math.max(low, high) };
  }

  return levels;
}

/**
 * Whether one number is usable as a rate.
 *
 * Zero and negatives are nonsense. The upper bound catches a model that has
 * answered in the wrong unit, which is the realistic failure: an annual salary
 * where a day rate was asked for reads as a plausible number and would be
 * wrong by a factor of two hundred.
 */
const MAX_SENSIBLE_RATE = 100_000;

function isRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < MAX_SENSIBLE_RATE;
}

/** The level somebody chose, narrowed off a string that came from a form. */
export function asLevel(value: unknown): ExpertiseLevel | null {
  return EXPERTISE_LEVELS.includes(value as ExpertiseLevel) ? (value as ExpertiseLevel) : null;
}
