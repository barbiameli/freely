import { prisma } from "@/lib/prisma";
import { researchMarketRate, type MarketRateQuery, type MarketRateAnswer } from "@/lib/anthropic";
import { resolveCountry } from "@/lib/countries";
import { parseLevels } from "@/lib/market-rate";

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
  query: Omit<MarketRateQuery, "industry" | "country"> & {
    industry: string | null;
    /** Their stated country, or null to fall back to what the currency implies. */
    country: string | null;
  }
): Promise<MarketRateAnswer> {
  const key: MarketRateQuery = {
    // A rate is a local number, so the country leads the key. Without it every
    // euro country shared one answer, which is an average of Lisbon and
    // Zurich and describes neither.
    country: resolveCountry(query.country, query.currency),
    industry: query.industry?.trim() || UNSPECIFIED_INDUSTRY,
    currency: query.currency,
    rateUnit: query.rateUnit,
  };
  const where = { country_industry_currency_rateUnit: key };

  // Cast, because the unique key gained a country and the generated client in
  // this workspace still describes the three-column one. Contained to these
  // two calls, the same way lib/track-db and lib/invoice-db contain theirs, so
  // it stops being needed the moment the client catches up.
  const table = prisma as unknown as {
    marketRateCache: {
      findUnique(args: {
        where: unknown;
      }): Promise<{ note: string; levels: unknown; refreshedAt: Date } | null>;
      upsert(args: { where: unknown; update: unknown; create: unknown }): Promise<unknown>;
    };
  };

  const cached = await table.marketRateCache.findUnique({ where });
  if (cached && Date.now() - cached.refreshedAt.getTime() < REFRESH_INTERVAL_MS) {
    return { note: cached.note, levels: parseLevels(cached.levels) };
  }

  const answer = await researchMarketRate(key);
  await table.marketRateCache.upsert({
    where,
    // The numbers are written as given or not at all. Writing a half-parsed
    // blob would put an invented figure in front of somebody deciding what to
    // charge, and a null simply means the chips are unavailable this time.
    update: { note: answer.note, levels: answer.levels ?? undefined, refreshedAt: new Date() },
    create: { ...key, note: answer.note, levels: answer.levels ?? undefined },
  });
  return answer;
}

/**
 * Just the paragraph, for the generation prompt.
 *
 * The quote generator wants prose to fold into a system prompt and has no use
 * for the numbers. A separate function rather than callers reaching for .note,
 * so the two readers of this cache stay honest about which part they need.
 */
export async function getMarketRateNote(
  query: Parameters<typeof getOrResearchMarketRate>[0]
): Promise<string> {
  const answer = await getOrResearchMarketRate(query);
  return answer.note;
}
