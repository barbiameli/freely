import { prisma } from "@/lib/prisma";
import { researchMarketRate, type MarketRateQuery } from "@/lib/anthropic";

/** How long a cached note is trusted before being re-researched — ADR-0001's
 * "quarterly" cadence, since rates for a given industry/currency/rateUnit
 * move over quarters, not days. */
const REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24 * 90;

/** No industry set on the account (pre-onboarding data, or a test) still
 * lands in one shared cache bucket rather than skipping the cache. */
const UNSPECIFIED_INDUSTRY = "general freelance work";

/**
 * The market rate for one (industry, currency, rateUnit) combination,
 * served from the Postgres cache when a fresh-enough row exists, otherwise
 * researched live and cached for next time (ADR-0001). This is the only
 * caller of researchMarketRate — generateBriefFromDraft never runs its own
 * web_search once a note comes back from here.
 */
export async function getOrResearchMarketRate(
  query: Omit<MarketRateQuery, "industry"> & { industry: string | null }
): Promise<string> {
  const key: MarketRateQuery = {
    industry: query.industry?.trim() || UNSPECIFIED_INDUSTRY,
    currency: query.currency,
    rateUnit: query.rateUnit,
  };
  const where = { industry_currency_rateUnit: key };

  const cached = await prisma.marketRateCache.findUnique({ where });
  if (cached && Date.now() - cached.refreshedAt.getTime() < REFRESH_INTERVAL_MS) {
    return cached.note;
  }

  const note = await researchMarketRate(key);
  await prisma.marketRateCache.upsert({
    where,
    update: { note, refreshedAt: new Date() },
    create: { ...key, note },
  });
  return note;
}
