import { z } from "zod";

/**
 * What freelancers like this one actually do.
 *
 * The corpus behind every comparison Freely makes. Telling somebody their
 * deposit is unusual, their rate is low or their payment terms are long is
 * only worth doing if the thing being compared against is real and can be
 * traced, so a benchmark row carries its sources and the date it was gathered,
 * and both are shown wherever a figure is used.
 *
 * Refreshed on a cycle rather than on demand. These figures move over months,
 * and researching them while a page loads would make opening a dashboard cost
 * a web search.
 */

/** How old a benchmark can get before it is worth researching again. */
export const STALE_AFTER_DAYS = 14;

/**
 * How many combinations one cron run refreshes.
 *
 * Each one is a web search and a model call, so two is about what fits in the
 * sixty seconds the route has. Whatever is not reached today is at the front
 * of the queue tomorrow, because the order is oldest first.
 */
export const RUN_LIMIT = 2;

export const benchmarkSchema = z.object({
  rateLow: z.number().positive(),
  rateHigh: z.number().positive(),
  currency: z.string().min(3).max(3),
  rateUnit: z.enum(["HOUR", "DAY"]).default("HOUR"),
  /**
   * The terms that are normal for this work, each optional.
   *
   * A pass that comes back sure about rates and unsure about how many calls a
   * project usually includes should say so. Filling the gap with a plausible
   * number is how a benchmark quietly becomes an opinion.
   */
  revisionRounds: z.number().int().min(0).max(20).nullable().default(null),
  depositPercent: z.number().int().min(0).max(100).nullable().default(null),
  paymentDays: z.number().int().min(1).max(120).nullable().default(null),
  acceptanceDays: z.number().int().min(1).max(60).nullable().default(null),
  callsIncluded: z.number().int().min(0).max(40).nullable().default(null),
  note: z.string().min(1),
  sources: z
    .array(z.object({ title: z.string().default(""), url: z.string().default("") }))
    .default([]),
});

export type BenchmarkFacts = z.infer<typeof benchmarkSchema>;

/** One row, as the app reads it. */
export interface Benchmark extends BenchmarkFacts {
  industry: string;
  country: string;
  level: string;
  refreshedAt: string;
}

/** Which combination to research next. */
export interface BenchmarkKey {
  industry: string;
  country: string;
  level: string;
  currency: string;
}

export function isStale(refreshedAt: Date | string, now = Date.now()): boolean {
  const at = typeof refreshedAt === "string" ? Date.parse(refreshedAt) : refreshedAt.getTime();
  return now - at > STALE_AFTER_DAYS * 86_400_000;
}

/**
 * The combinations worth researching, and their order.
 *
 * Only the ones somebody's account actually uses. Researching every kind of
 * work in every country would be tens of thousands of web searches for
 * figures nobody would read, and the set in use is small and grows with the
 * user base rather than ahead of it.
 *
 * Missing before stale: an account with no benchmark at all gets nothing when
 * it opens the page, and an account with a two-week-old one gets a slightly
 * old number. Oldest first within each group, so nothing starves.
 */
export function nextToResearch(
  inUse: BenchmarkKey[],
  existing: { industry: string; country: string; level: string; refreshedAt: Date }[],
  limit = RUN_LIMIT,
  now = Date.now()
): BenchmarkKey[] {
  const id = (k: { industry: string; country: string; level: string }) =>
    `${k.industry}|${k.country}|${k.level}`;
  const have = new Map(existing.map((row) => [id(row), row.refreshedAt.getTime()]));

  const missing: BenchmarkKey[] = [];
  const stale: { key: BenchmarkKey; at: number }[] = [];

  const seen = new Set<string>();
  for (const key of inUse) {
    const k = id(key);
    if (seen.has(k)) continue;
    seen.add(k);
    const at = have.get(k);
    if (at === undefined) missing.push(key);
    else if (now - at > STALE_AFTER_DAYS * 86_400_000) stale.push({ key, at });
  }

  stale.sort((a, b) => a.at - b.at);
  return [...missing, ...stale.map((s) => s.key)].slice(0, limit);
}

/** The research request. */
export function buildBenchmarkPrompt(
  key: BenchmarkKey,
  labels: { industry: string; country: string }
): { system: string; user: string } {
  const system = [
    "You research what freelancers in a given field, country and experience level actually charge and actually put in their contracts. Use web search, then answer with JSON and nothing else.",
    'Exactly this shape: {"rateLow": 0, "rateHigh": 0, "currency": "XXX", "rateUnit": "HOUR", "revisionRounds": 0, "depositPercent": 0, "paymentDays": 0, "acceptanceDays": 0, "callsIncluded": 0, "note": "...", "sources": [{"title": "...", "url": "..."}]}.',
    "rateLow and rateHigh are whole amounts in the currency given, with no symbols or separators, for the experience level given.",
    "revisionRounds, depositPercent, paymentDays, acceptanceDays and callsIncluded are the figures that are normal for this kind of work: rounds of changes typically included, deposit typically taken before starting, days a client typically has to pay, business days after which delivered work is typically treated as accepted, and calls typically included.",
    "Return null for any of those five you cannot find a real basis for. Do not fill a gap with a plausible number: a figure nobody published is worse than no figure, because it will be used to tell somebody they are out of step.",
    "note is one short paragraph a freelancer can read: the rate range, the terms that are normal, and what kind of sources this came from.",
    "sources is up to four of the pages you actually used, with their real titles and URLs.",
    "Where the law sets a baseline that beats practice, say so in the note. Statutory payment terms are an example.",
    "No preamble, no markdown, no code fences.",
  ].join(" ");

  const user = [
    `Field: ${labels.industry}`,
    `Country: ${labels.country}`,
    `Experience level: ${key.level}`,
    `Currency: ${key.currency}`,
    "",
    "What do freelancers like this charge per hour, and what do their contracts usually say?",
  ].join("\n");

  return { system, user };
}
