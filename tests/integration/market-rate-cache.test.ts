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
  anthropicMocks.researchMarketRate.mockResolvedValue("$60-90/hr, per industry job boards.");
});

afterEach(async () => {
  vi.clearAllMocks();
  await resetTestDb();
});

describe("getOrResearchMarketRate", () => {
  it("researches and caches on a miss", async () => {
    const note = await getOrResearchMarketRate({
      industry: "ux-designer",
      currency: "USD",
      rateUnit: "HOUR",
    });

    expect(note).toBe("$60-90/hr, per industry job boards.");
    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledTimes(1);
    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledWith({
      industry: "ux-designer",
      currency: "USD",
      rateUnit: "HOUR",
    });

    const row = await testDb.marketRateCache.findUniqueOrThrow({
      where: {
        industry_currency_rateUnit: { industry: "ux-designer", currency: "USD", rateUnit: "HOUR" },
      },
    });
    expect(row.note).toBe("$60-90/hr, per industry job boards.");
  });

  it("serves a fresh cache hit without calling researchMarketRate again", async () => {
    await testDb.marketRateCache.create({
      data: {
        industry: "ux-designer",
        currency: "USD",
        rateUnit: "HOUR",
        note: "cached note",
        refreshedAt: new Date(),
      },
    });

    const note = await getOrResearchMarketRate({
      industry: "ux-designer",
      currency: "USD",
      rateUnit: "HOUR",
    });

    expect(note).toBe("cached note");
    expect(anthropicMocks.researchMarketRate).not.toHaveBeenCalled();
  });

  it("re-researches and overwrites a cache row older than the quarterly refresh window", async () => {
    const overQuarterAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 91);
    await testDb.marketRateCache.create({
      data: {
        industry: "ux-designer",
        currency: "USD",
        rateUnit: "HOUR",
        note: "stale note",
        refreshedAt: overQuarterAgo,
      },
    });

    const note = await getOrResearchMarketRate({
      industry: "ux-designer",
      currency: "USD",
      rateUnit: "HOUR",
    });

    expect(note).toBe("$60-90/hr, per industry job boards.");
    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledTimes(1);

    const row = await testDb.marketRateCache.findUniqueOrThrow({
      where: {
        industry_currency_rateUnit: { industry: "ux-designer", currency: "USD", rateUnit: "HOUR" },
      },
    });
    expect(row.note).toBe("$60-90/hr, per industry job boards.");
    expect(row.refreshedAt.getTime()).toBeGreaterThan(overQuarterAgo.getTime());
  });

  it("keeps industry, currency, and rateUnit as separate cache buckets", async () => {
    await getOrResearchMarketRate({ industry: "ux-designer", currency: "USD", rateUnit: "HOUR" });
    anthropicMocks.researchMarketRate.mockResolvedValueOnce("EUR day rate note");
    await getOrResearchMarketRate({ industry: "ux-designer", currency: "EUR", rateUnit: "DAY" });

    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledTimes(2);
    expect(await testDb.marketRateCache.count()).toBe(2);
  });

  it("falls back to a shared bucket when the account has no industry set", async () => {
    const note = await getOrResearchMarketRate({ industry: null, currency: "USD", rateUnit: "HOUR" });

    expect(note).toBe("$60-90/hr, per industry job boards.");
    expect(anthropicMocks.researchMarketRate).toHaveBeenCalledWith(
      expect.objectContaining({ industry: "general freelance work" })
    );
  });
});
