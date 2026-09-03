import type { Benchmark } from "@/lib/benchmarks";

/**
 * What somebody's own quoting looks like from the outside, and where it sits
 * against what other freelancers do.
 *
 * The point is not to score anybody. It is that the things which cost a
 * freelancer money are invisible one quote at a time and obvious across ten:
 * never taking a deposit, a rate that has not moved in a year, quotes that go
 * out and are never chased. Nobody notices those from inside a single quote,
 * and everybody notices them in a row.
 *
 * Every comparison names the figure it is comparing against and where that
 * figure came from, and nothing here fires without one. A flag that says "this
 * is unusual" without saying unusual compared to what is an opinion with a
 * number on it.
 */

/** One quote, reduced to what a pattern needs. */
export interface QuoteFact {
  id: string;
  published: boolean;
  /** "PENDING" | "WON" | "LOST". */
  outcome: string;
  price: number;
  hours: number;
  rate: number | null;
  currency: string | null;
  /** "UPFRONT" | "SPLIT" | "ON_DELIVERY" | "MILESTONE". */
  paymentPlan: string;
  upfrontPercent: number;
  /** Whether the quote actually carries these, after removals. */
  hasAssumptions: boolean;
  hasPaymentTerms: boolean;
  createdAt: string;
  /** When it was signed, where it was. */
  acceptedAt: string | null;
}

export interface InvoiceFact {
  id: string;
  total: number;
  currency: string;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
}

export type FlagTone = "urgent" | "mild" | "fact";

export interface Pattern {
  key: string;
  tone: FlagTone;
  /** The observation about their own work. Filled from `values`. */
  observed: string;
  /** What it is being compared against, and from where. */
  compared: string;
  values: Record<string, string>;
  /** The rule or page that acts on it, where there is one. */
  fixHref?: string;
}

/** Enough of a sample that a pattern is a pattern rather than a coincidence. */
const MIN_QUOTES = 4;

function share(matching: number, total: number): number {
  return total === 0 ? 0 : matching / total;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function days(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * The patterns worth raising, most costly first.
 *
 * Capped by the caller rather than here, because how many a page can carry is
 * a question about the page. What this decides is the order, and the order is
 * money you are not being paid, then money you are being paid late, then money
 * you are not asking for.
 */
export function patternsFor(
  quotes: QuoteFact[],
  invoices: InvoiceFact[],
  benchmark: Benchmark | null
): Pattern[] {
  const found: Pattern[] = [];
  if (quotes.length < MIN_QUOTES) return found;

  // Nothing up front, on most of them. The one that turns into an unpaid
  // invoice for the whole project rather than for the last part of it.
  const noDeposit = quotes.filter(
    (q) => q.paymentPlan === "ON_DELIVERY" || (q.paymentPlan === "SPLIT" && q.upfrontPercent === 0)
  );
  if (
    benchmark?.depositPercent != null &&
    benchmark.depositPercent > 0 &&
    share(noDeposit.length, quotes.length) >= 0.5
  ) {
    found.push({
      key: "noDeposit",
      tone: "urgent",
      observed: "patternNoDeposit",
      compared: "patternNoDepositNorm",
      values: {
        count: String(noDeposit.length),
        total: String(quotes.length),
        percent: String(benchmark.depositPercent),
      },
      fixHref: "/rules",
    });
  }

  // A rate that has not moved, on work that is never pushed back on.
  const rates = quotes.map((q) => q.rate).filter((r): r is number => typeof r === "number" && r > 0);
  const theirRate = median(rates);
  if (
    theirRate !== null &&
    benchmark &&
    benchmark.rateLow > 0 &&
    theirRate < benchmark.rateLow &&
    // Same rate throughout, which is what makes it a habit rather than a
    // decision about one job.
    new Set(rates).size <= 2
  ) {
    found.push({
      key: "rateBelow",
      tone: "urgent",
      observed: "patternRateBelow",
      compared: "patternRateBelowNorm",
      values: {
        rate: String(Math.round(theirRate)),
        low: String(Math.round(benchmark.rateLow)),
        high: String(Math.round(benchmark.rateHigh)),
        count: String(rates.length),
      },
      fixHref: "/memory#quotes",
    });
  }

  // Quotes that go out and are never answered, with nothing in them saying
  // what happens when nobody replies.
  const sent = quotes.filter((q) => q.published);
  const answered = sent.filter((q) => q.outcome !== "PENDING" || q.acceptedAt);
  const waits = answered
    .map((q) => days(q.createdAt, q.acceptedAt ?? new Date().toISOString()))
    .filter((d) => d >= 0);
  const typicalWait = median(waits);
  if (
    typicalWait !== null &&
    typicalWait > 14 &&
    benchmark?.acceptanceDays != null &&
    sent.length >= MIN_QUOTES
  ) {
    found.push({
      key: "slowAnswers",
      tone: "mild",
      observed: "patternSlowAnswers",
      compared: "patternSlowAnswersNorm",
      values: { days: String(Math.round(typicalWait)), norm: String(benchmark.acceptanceDays) },
      fixHref: "/rules",
    });
  }

  // Invoices paid later than the terms they were sent under.
  const paid = invoices.filter((i) => i.paidAt);
  const lateness = paid.map((i) => days(i.dueAt, i.paidAt!)).filter((d) => Number.isFinite(d));
  const typicalLateness = median(lateness);
  if (typicalLateness !== null && typicalLateness > 3 && paid.length >= 3) {
    found.push({
      key: "paidLate",
      tone: "urgent",
      observed: "patternPaidLate",
      compared: "patternPaidLateNorm",
      values: {
        days: String(Math.round(typicalLateness)),
        count: String(paid.length),
        norm: benchmark?.paymentDays != null ? String(benchmark.paymentDays) : "14",
      },
      fixHref: "/rules",
    });
  }

  // Quotes going out with nothing saying what the price rests on.
  const noAssumptions = quotes.filter((q) => !q.hasAssumptions);
  if (share(noAssumptions.length, quotes.length) >= 0.6) {
    found.push({
      key: "noAssumptions",
      tone: "mild",
      observed: "patternNoAssumptions",
      compared: "patternNoAssumptionsNorm",
      values: { count: String(noAssumptions.length), total: String(quotes.length) },
      fixHref: "/rules",
    });
  }

  return found;
}
