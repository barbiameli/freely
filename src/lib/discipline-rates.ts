import type { RateUnit } from "@/lib/rate-unit";

/**
 * One rate, for one kind of work.
 *
 * The rule the whole feature rests on: a client buying a build is not buying
 * design, and the two do not pay the same. So the rate belongs to the
 * discipline rather than to the person, and every place that shows a rate shows
 * which work it is for.
 */
export interface DisciplineRate {
  rate: number;
  unit: RateUnit;
}

/** The account's rates, as stored. Main discipline included. */
export type DisciplineRates = Record<string, DisciplineRate>;

function isUnit(value: unknown): value is RateUnit {
  return value === "HOUR" || value === "DAY" || value === "FIXED";
}

/**
 * Reads the map off an account, dropping anything malformed.
 *
 * A Json column holds whatever was written to it, including rows from a version
 * of the app where the shape was different. A rate that cannot be trusted is
 * worse than no rate: it would silently price somebody's work.
 */
export function parseRates(value: unknown): DisciplineRates {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: DisciplineRates = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const { rate, unit } = entry as { rate?: unknown; unit?: unknown };
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) continue;
    out[key] = { rate, unit: isUnit(unit) ? unit : "HOUR" };
  }
  return out;
}

/**
 * The rate for one kind of work, or nothing.
 *
 * The main discipline falls back to the account's own rate columns, so every
 * account that existed before this keeps the rate it already had without a
 * migration writing anything.
 *
 * Nothing is a real answer, and the caller is expected to say so out loud
 * rather than quietly substituting another discipline's number. Quoting a
 * marketing job at a design rate is the bug this whole shape exists to stop.
 */
export function rateFor(
  discipline: string | null | undefined,
  account: {
    industry?: string | null;
    defaultRate?: number | null;
    defaultRateUnit?: string | null;
    ratesByDiscipline?: unknown;
  }
): DisciplineRate | null {
  if (!discipline) return null;
  const rates = parseRates(account.ratesByDiscipline);
  const stored = rates[discipline];
  if (stored) return stored;

  if (discipline === account.industry && account.defaultRate && account.defaultRate > 0) {
    return {
      rate: account.defaultRate,
      unit: isUnit(account.defaultRateUnit) ? account.defaultRateUnit : "HOUR",
    };
  }
  return null;
}

/** The map with one discipline set, ready to store. */
export function withRate(
  current: unknown,
  discipline: string,
  rate: DisciplineRate
): DisciplineRates {
  return { ...parseRates(current), [discipline]: rate };
}

/**
 * Which of their disciplines still have no rate.
 *
 * Used to say so before a quote is written rather than after it is priced.
 */
export function disciplinesWithoutRate(
  disciplines: string[],
  account: Parameters<typeof rateFor>[1]
): string[] {
  return disciplines.filter((key) => !rateFor(key, account));
}

/** The readable name of a discipline, falling back to the key. */
export function disciplineLabel(
  key: string,
  disciplines: { key: string; label: string }[]
): string {
  return disciplines.find((d) => d.key === key)?.label ?? key;
}
