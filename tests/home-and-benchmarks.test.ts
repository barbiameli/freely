import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  benchmarkSchema,
  buildBenchmarkPrompt,
  isStale,
  nextToResearch,
  RUN_LIMIT,
  STALE_AFTER_DAYS,
} from "@/lib/benchmarks";
import { patternsFor, type QuoteFact, type InvoiceFact } from "@/lib/quote-patterns";
import type { Benchmark } from "@/lib/benchmarks";
import { dict, fill } from "@/lib/i18n";

const NOW = Date.parse("2026-09-03T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000);

const reference: Benchmark = {
  industry: "ux-designer",
  country: "IE",
  level: "Senior",
  rateLow: 65,
  rateHigh: 110,
  currency: "USD",
  rateUnit: "HOUR",
  revisionRounds: 2,
  depositPercent: 50,
  paymentDays: 14,
  acceptanceDays: 10,
  callsIncluded: 2,
  note: "Researched range.",
  sources: [{ title: "A study", url: "https://example.com" }],
  refreshedAt: new Date(NOW).toISOString(),
};

function quote(over: Partial<QuoteFact> = {}): QuoteFact {
  return {
    id: Math.random().toString(36).slice(2),
    published: true,
    outcome: "PENDING",
    price: 650,
    hours: 13,
    rate: 50,
    currency: "USD",
    paymentPlan: "ON_DELIVERY",
    upfrontPercent: 0,
    hasAssumptions: false,
    hasPaymentTerms: true,
    createdAt: daysAgo(40).toISOString(),
    acceptedAt: null,
    ...over,
  };
}

/**
 * The corpus behind every comparison, and the comparisons themselves.
 *
 * The rule these tests exist to hold: nothing tells a freelancer they are out
 * of step without a real figure to be out of step with. A benchmark that
 * guessed, or a pattern computed from three quotes, is an opinion with a
 * number on it.
 */
describe("the benchmark corpus", () => {
  it("keeps a figure it cannot find as nothing rather than a guess", () => {
    const parsed = benchmarkSchema.parse({
      rateLow: 65,
      rateHigh: 110,
      currency: "USD",
      note: "Rates found, terms not.",
    });
    expect(parsed.revisionRounds).toBeNull();
    expect(parsed.depositPercent).toBeNull();
    expect(parsed.sources).toEqual([]);
  });

  it("refuses a row with no rates or no note", () => {
    expect(benchmarkSchema.safeParse({ currency: "USD", note: "x" }).success).toBe(false);
    expect(
      benchmarkSchema.safeParse({ rateLow: 1, rateHigh: 2, currency: "USD" }).success
    ).toBe(false);
  });

  it("tells the model not to fill a gap with a plausible number", () => {
    const { system } = buildBenchmarkPrompt(
      { industry: "ux-designer", country: "IE", level: "Senior", currency: "USD" },
      { industry: "UX designer", country: "Ireland" }
    );
    expect(system).toContain("Do not fill a gap with a plausible number");
    expect(system).toContain("sources");
  });

  it("names the field, country, level and currency it is asking about", () => {
    const { user } = buildBenchmarkPrompt(
      { industry: "ux-designer", country: "IE", level: "Senior", currency: "EUR" },
      { industry: "UX designer", country: "Ireland" }
    );
    expect(user).toContain("UX designer");
    expect(user).toContain("Ireland");
    expect(user).toContain("Senior");
    expect(user).toContain("EUR");
  });

  it("counts a fortnight-old row as stale", () => {
    expect(isStale(daysAgo(STALE_AFTER_DAYS + 1), NOW)).toBe(true);
    expect(isStale(daysAgo(1), NOW)).toBe(false);
  });
});

describe("what to research next", () => {
  const key = (industry: string, level = "Senior") => ({
    industry,
    country: "IE",
    level,
    currency: "USD",
  });

  it("researches only what somebody's account actually uses", () => {
    // Every field in every country would be tens of thousands of searches for
    // figures nobody would read.
    const queue = nextToResearch([key("ux-designer")], [], 5, NOW);
    expect(queue.map((k) => k.industry)).toEqual(["ux-designer"]);
  });

  it("fills a gap before refreshing an old one", () => {
    // An account with no benchmark gets nothing at all when it opens the page.
    const queue = nextToResearch(
      [key("copywriter"), key("ux-designer")],
      [{ industry: "ux-designer", country: "IE", level: "Senior", refreshedAt: daysAgo(90) }],
      5,
      NOW
    );
    expect(queue.map((k) => k.industry)).toEqual(["copywriter", "ux-designer"]);
  });

  it("leaves a fresh row alone", () => {
    const queue = nextToResearch(
      [key("ux-designer")],
      [{ industry: "ux-designer", country: "IE", level: "Senior", refreshedAt: daysAgo(2) }],
      5,
      NOW
    );
    expect(queue).toEqual([]);
  });

  it("takes the oldest first, and only as many as a run can manage", () => {
    const queue = nextToResearch(
      [key("a"), key("b"), key("c")],
      [
        { industry: "a", country: "IE", level: "Senior", refreshedAt: daysAgo(20) },
        { industry: "b", country: "IE", level: "Senior", refreshedAt: daysAgo(90) },
        { industry: "c", country: "IE", level: "Senior", refreshedAt: daysAgo(40) },
      ],
      2,
      NOW
    );
    expect(queue.map((k) => k.industry)).toEqual(["b", "c"]);
    expect(RUN_LIMIT).toBeLessThanOrEqual(4);
  });

  it("does not queue the same combination twice", () => {
    const queue = nextToResearch([key("a"), key("a")], [], 5, NOW);
    expect(queue).toHaveLength(1);
  });
});

describe("patterns in somebody's own quoting", () => {
  it("says nothing at all from too few quotes", () => {
    // Three quotes is a coincidence. A pattern needs a run.
    expect(patternsFor([quote(), quote(), quote()], [], reference)).toEqual([]);
  });

  it("says nothing without a benchmark to compare against", () => {
    const quotes = [quote(), quote(), quote(), quote(), quote()];
    const keys = patternsFor(quotes, [], null).map((p) => p.key);
    expect(keys).not.toContain("noDeposit");
    expect(keys).not.toContain("rateBelow");
  });

  it("catches a run of quotes with nothing up front", () => {
    const quotes = [quote(), quote(), quote(), quote(), quote()];
    const found = patternsFor(quotes, [], reference).find((p) => p.key === "noDeposit");
    expect(found).toBeTruthy();
    expect(found?.values).toMatchObject({ count: "5", total: "5", percent: "50" });
  });

  it("leaves somebody who does take a deposit alone", () => {
    const quotes = Array.from({ length: 5 }, () =>
      quote({ paymentPlan: "SPLIT", upfrontPercent: 50 })
    );
    expect(patternsFor(quotes, [], reference).map((p) => p.key)).not.toContain("noDeposit");
  });

  it("catches a rate that has not moved and sits under the range", () => {
    const quotes = Array.from({ length: 5 }, () => quote());
    const found = patternsFor(quotes, [], reference).find((p) => p.key === "rateBelow");
    expect(found?.values).toMatchObject({ rate: "50", low: "65", high: "110" });
  });

  it("does not call a rate low when it is inside the range", () => {
    const quotes = Array.from({ length: 5 }, () => quote({ rate: 80 }));
    expect(patternsFor(quotes, [], reference).map((p) => p.key)).not.toContain("rateBelow");
  });

  it("does not call a rate a habit when it has been moving", () => {
    const rates = [40, 45, 50, 55, 60];
    const quotes = rates.map((rate) => quote({ rate }));
    expect(patternsFor(quotes, [], reference).map((p) => p.key)).not.toContain("rateBelow");
  });

  it("catches invoices paid later than their own terms", () => {
    const invoices: InvoiceFact[] = Array.from({ length: 3 }, (_, i) => ({
      id: String(i),
      total: 1000,
      currency: "USD",
      issuedAt: daysAgo(60).toISOString(),
      dueAt: daysAgo(40).toISOString(),
      paidAt: daysAgo(20).toISOString(),
    }));
    const quotes = Array.from({ length: 5 }, () => quote());
    const found = patternsFor(quotes, invoices, reference).find((p) => p.key === "paidLate");
    expect(found?.values.days).toBe("20");
  });

  it("stays quiet about invoices paid on time", () => {
    const invoices: InvoiceFact[] = Array.from({ length: 3 }, (_, i) => ({
      id: String(i),
      total: 1000,
      currency: "USD",
      issuedAt: daysAgo(30).toISOString(),
      dueAt: daysAgo(16).toISOString(),
      paidAt: daysAgo(17).toISOString(),
    }));
    const quotes = Array.from({ length: 5 }, () => quote());
    expect(patternsFor(quotes, invoices, reference).map((p) => p.key)).not.toContain("paidLate");
  });

  it("has readable copy for every pattern it can raise, in both languages", () => {
    const quotes = Array.from({ length: 5 }, () => quote());
    const invoices: InvoiceFact[] = Array.from({ length: 3 }, (_, i) => ({
      id: String(i),
      total: 1000,
      currency: "USD",
      issuedAt: daysAgo(60).toISOString(),
      dueAt: daysAgo(40).toISOString(),
      paidAt: daysAgo(20).toISOString(),
    }));
    const found = patternsFor(quotes, invoices, reference);
    expect(found.length).toBeGreaterThan(2);

    for (const locale of ["en", "es"] as const) {
      const words = dict(locale).home as unknown as Record<string, string>;
      for (const pattern of found) {
        const observed = words[pattern.observed];
        const compared = words[pattern.compared];
        expect(observed, `${pattern.key} ${locale}`).toBeTruthy();
        expect(compared, `${pattern.key} ${locale}`).toBeTruthy();
        // No placeholder survives into what somebody reads.
        expect(fill(observed, pattern.values)).not.toMatch(/\{\w+\}/);
        expect(fill(compared, pattern.values)).not.toMatch(/\{\w+\}/);
      }
    }
  });
});

describe("how the home page uses it", () => {
  const page = readFileSync("src/app/(app)/home/page.tsx", "utf8");
  const view = readFileSync("src/app/(app)/home/home-view.tsx", "utf8");
  const cron = readFileSync("src/app/api/cron/benchmarks/route.ts", "utf8");

  it("never waits on a web search to render", () => {
    // The corpus is refreshed by cron. A page that researched its own
    // comparisons would cost a web search to open.
    expect(page).not.toContain("researchBenchmark");
    expect(cron).toContain("researchBenchmark");
  });

  it("caps how much it tells you at once", () => {
    expect(page).toContain(".slice(0, 2)");
  });

  it("says where the figures came from, and that they are not peer data", () => {
    expect(view).toContain("t.home.patternSource");
    expect(dict("en").home.patternSource).toContain("Not from other Freely accounts");
  });

  it("authenticates the cron and never lets it 500", () => {
    expect(cron).toContain("Bearer ${secret}");
    expect(cron).toContain('return NextResponse.json({ ok: false, error: "Run failed." });');
  });

  it("leaves a good row alone when a research pass comes back unusable", () => {
    expect(cron).toContain("if (!facts) continue;");
  });
});
