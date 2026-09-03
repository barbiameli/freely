import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { researchBenchmark } from "@/lib/anthropic";
import { nextToResearch, RUN_LIMIT, type BenchmarkKey } from "@/lib/benchmarks";
import { allDisciplines, industryLabel } from "@/lib/industries";
import { countryName } from "@/lib/countries";
import { resolveExpertise } from "@/lib/quote-defaults";

/**
 * Keeping the benchmark corpus fresh.
 *
 * Runs daily and refreshes the two oldest combinations that any account
 * actually uses. Two, because each one is a web search and a model call and
 * this route has sixty seconds; daily rather than fortnightly, because two a
 * day covers far more ground than a larger batch every two weeks and nothing
 * has to fit in one run.
 *
 * Only combinations in use. Researching every kind of work in every country
 * would be tens of thousands of searches for figures nobody would read, and
 * the set grows with the user base rather than ahead of it.
 *
 * Never throws. A cron that 500s gets retried, and a retried research pass is
 * a second web search for an answer already written.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  try {
    // Every account's own combinations, including the other kinds of work they
    // said they do: somebody who designs and writes gets compared against
    // writers when they quote writing.
    // Selected wholesale rather than by column: country and otherIndustries
    // are newer than the generated client in some environments, and a named
    // select would not compile there. The cast is contained to this read.
    const users = (await prisma.user.findMany({
      where: { industry: { not: "" } },
    })) as unknown as {
      industry: string;
      country: string | null;
      currency: string | null;
      expertiseLevel: string | null;
      inferredExpertise: string | null;
      otherIndustries?: string[];
    }[];

    const inUse: BenchmarkKey[] = [];
    for (const user of users) {
      const level = resolveExpertise(user.expertiseLevel, user.inferredExpertise);
      const country = user.country || "??";
      const currency = user.currency || "USD";
      for (const industry of allDisciplines(user.industry, user.otherIndustries)) {
        inUse.push({ industry, country, level, currency });
      }
    }

    // Same reason, one table further: Benchmark is newer than the generated
    // client, so the model is reached through a narrow shape rather than by
    // name. See the same pattern in actions/briefs.
    const benchmarks = (prisma as unknown as {
      benchmark: {
        findMany(args: { select: Record<string, boolean> }): Promise<
          { industry: string; country: string; level: string; refreshedAt: Date }[]
        >;
        upsert(args: {
          where: {
            industry_country_level: { industry: string; country: string; level: string };
          };
          update: Record<string, unknown>;
          create: Record<string, unknown>;
        }): Promise<unknown>;
      };
    }).benchmark;

    const existing = await benchmarks.findMany({
      select: { industry: true, country: true, level: true, refreshedAt: true },
    });

    const queue = nextToResearch(inUse, existing, RUN_LIMIT);
    const done: string[] = [];

    for (const key of queue) {
      const facts = await researchBenchmark(key, {
        industry: industryLabel(key.industry),
        country: countryName(key.country) ?? key.country,
      });
      // A pass that came back unusable leaves the old row alone. Replacing a
      // real benchmark with an empty one would turn a slightly stale figure
      // into no figure, and the whole page rests on these.
      if (!facts) continue;

      const data = {
        ...facts,
        sources: facts.sources as unknown as Prisma.InputJsonValue,
        refreshedAt: new Date(),
      };
      await benchmarks.upsert({
        where: {
          industry_country_level: {
            industry: key.industry,
            country: key.country,
            level: key.level,
          },
        },
        update: data,
        create: { ...data, industry: key.industry, country: key.country, level: key.level },
      });
      done.push(`${key.industry}/${key.country}/${key.level}`);
    }

    return NextResponse.json({ ok: true, considered: queue.length, refreshed: done });
  } catch (err) {
    console.error("[cron/benchmarks] failed", err);
    // Reported as handled: a retry would spend another web search on work that
    // may already have landed.
    return NextResponse.json({ ok: false, error: "Run failed." });
  }
}
