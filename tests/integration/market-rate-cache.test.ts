import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDb, testDb } from "../support/db";
import { getOrResearchMarketRate } from "@/lib/market-rate-cache";

/**
 * ADR-0001: market-rate research cached in Postgres rather than re-run with
 * a live web_search call on every quote. Only the Claude call is mocked —
 * there's no real Anthropic key in tests — everything else runs against the
 * real test Postgres (ADR-0002).
 */
const anthropicMocks = vi.hoisted(() => ({
  researchMarketRate: vi.fn(),
}));

vi.mock("@/lib/anthropic", () => ({
  researchMarketRate: anthropicMocks.researchMarketRate,
}));

beforeEach(() => {
  // The research now answers with prose and numbers. The prose is what the
  // generation prompt folds in; the numbers are what the rate helper offers as
  // chips. Both come back from one call so the cache holds one row.
  anthropicMocks.researchMarketRate.mockResolvedValue({
    note: "$60-90/hr, per industry job boards.",
    levels: {
      Junior: { low: 40, high: 55 },
      "Mid-level": { low: 55, high: 75 },
      Senior: { low: 75, high: 100 },
      Expert: { low: 100, high: 140 },
    },
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  await resetTestDb();
});

describe("getOrResearchMarketRate", () => {
  it("researches and caches on a miss", async () => {
    const answer = await getOrResearchMarketRate({
      country: "US",
      industry: "ux-designer",
      currency: "USD",
      rateUnit: "HOUR",
    });

    expect(answer.note).toBe("$60-90/hr, per industry job boards.");
    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledTimes(1);
    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledWith({
      country: "US",
      industry: "ux-designer",
      currency: "USD",
      rateUnit: "HOUR",
    });

    const row = await testDb.marketRateCache.findUniqueOrThrow({
      where: {
        country_industry_currency_rateUnit: {
          country: "US",
          industry: "ux-designer",
          currency: "USD",
          rateUnit: "HOUR",
        },
      },
    });
    expect(row.note).toBe("$60-90/hr, per industry job boards.");
  });

  it("serves a fresh cache hit without calling researchMarketRate again", async () => {
    await testDb.marketRateCache.create({
      data: {
        country: "US",
        industry: "ux-designer",
        currency: "USD",
        rateUnit: "HOUR",
        note: "cached note",
        refreshedAt: new Date(),
      },
    });

    const answer = await getOrResearchMarketRate({
      country: "US",
      industry: "ux-designer",
      currency: "USD",
      rateUnit: "HOUR",
    });

    expect(answer.note).toBe("cached note");
    expect(anthropicMocks.researchMarketRate).not.toHaveBeenCalled();
  });

  it("re-researches and overwrites a cache row older than the quarterly refresh window", async () => {
    const overQuarterAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 91);
    await testDb.marketRateCache.create({
      data: {
        country: "US",
        industry: "ux-designer",
        currency: "USD",
        rateUnit: "HOUR",
        note: "stale note",
        refreshedAt: overQuarterAgo,
      },
    });

    const answer = await getOrResearchMarketRate({
      country: "US",
      industry: "ux-designer",
      currency: "USD",
      rateUnit: "HOUR",
    });

    expect(answer.note).toBe("$60-90/hr, per industry job boards.");
    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledTimes(1);

    const row = await testDb.marketRateCache.findUniqueOrThrow({
      where: {
        country_industry_currency_rateUnit: {
          country: "US",
          industry: "ux-designer",
          currency: "USD",
          rateUnit: "HOUR",
        },
      },
    });
    expect(row.note).toBe("$60-90/hr, per industry job boards.");
    expect(row.refreshedAt.getTime()).toBeGreaterThan(overQuarterAgo.getTime());
  });

  it("keeps industry, currency, and rateUnit as separate cache buckets", async () => {
    await getOrResearchMarketRate({
      country: "US",
      industry: "ux-designer",
      currency: "USD",
      rateUnit: "HOUR",
    });
    anthropicMocks.researchMarketRate.mockResolvedValueOnce({ note: "EUR day rate note", levels: null });
    await getOrResearchMarketRate({
      country: "US",
      industry: "ux-designer",
      currency: "EUR",
      rateUnit: "DAY",
    });

    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledTimes(2);
    expect(await testDb.marketRateCache.count()).toBe(2);
  });

  // The reason country was added at all: two freelancers on the same currency
  // in different countries were being handed one another's number.
  it("keeps two countries on one currency apart", async () => {
    await getOrResearchMarketRate({
      country: "PT",
      industry: "ux-designer",
      currency: "EUR",
      rateUnit: "HOUR",
    });
    anthropicMocks.researchMarketRate.mockResolvedValueOnce({ note: "German hourly note", levels: null });
    await getOrResearchMarketRate({
      country: "DE",
      industry: "ux-designer",
      currency: "EUR",
      rateUnit: "HOUR",
    });

    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledTimes(2);
    expect(await testDb.marketRateCache.count()).toBe(2);
  });

  // Nobody who states a rate is asked where they are, so the country arrives
  // null and the currency has to answer for it.
  it("researches against the currency's country when none was given", async () => {
    await getOrResearchMarketRate({
      country: null,
      industry: "ux-designer",
      currency: "GBP",
      rateUnit: "HOUR",
    });

    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledWith(
      expect.objectContaining({ country: "GB" })
    );
  });

  it("falls back to a shared bucket when the account has no industry set", async () => {
    const answer = await getOrResearchMarketRate({
      country: "US",
      industry: null,
      currency: "USD",
      rateUnit: "HOUR",
    });

    expect(answer.note).toBe("$60-90/hr, per industry job boards.");
    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledWith(
      expect.objectContaining({ industry: "general freelance work" })
    );
  });
});
