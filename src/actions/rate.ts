"use server";

import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { getOrResearchMarketRate } from "@/lib/market-rate-cache";
import { enforceLlmRateLimit } from "@/lib/rate-limit";
import { isKnownCountry, countryName } from "@/lib/countries";
import { asLevel, pickThree, midpoint } from "@/lib/market-rate";
import { parseRateUnit } from "@/lib/rate-unit";
import type { ActionResult } from "@/actions/briefs";

export interface ResearchedRate {
  /** Two or three figures to choose between, lowest first. */
  options: number[];
  /**
   * The one already filled in, or zero when the numbers could not be read.
   *
   * A researched rate nobody adopted is not a rate, so the middle is taken
   * rather than left blank. The other two are one press away, and the field
   * stays typeable, so this is a starting point rather than an answer.
   */
  suggested: number;
  /** The paragraph, so the numbers can be checked rather than trusted. */
  note: string;
  /** Written out, for saying which market this is. */
  country: string;
}

/**
 * A rate for one level, in one country, now.
 *
 * Asked at the moment somebody says they do not know what to charge, rather
 * than resolved quietly in the background at signup. Two reasons, and both are
 * about the same thing.
 *
 * They see it happen, so the number has a visible provenance. A figure that
 * appears in a field on its own is one nobody trusts and everybody retypes.
 *
 * And they choose from it. There is no single correct rate for a senior
 * designer in Britain, so offering one would be a confidence the evidence does
 * not support. A low, a middle and a high says what is actually true and leaves
 * the judgment where it belongs, which is with the person who has to say the
 * number out loud to a client.
 *
 * The country is saved on the way past, since it is the same answer the quote
 * generator needs and asking twice is the complaint this whole thread began
 * with.
 */
export async function researchRateAction(input: {
  expertise: string;
  country: string;
  currency: string;
  rateUnit: string;
}): Promise<ActionResult<ResearchedRate>> {
  const user = await requireFullUser();

  const level = asLevel(input.expertise);
  if (!level) return { ok: false, error: "Pick your level first." };
  if (!isKnownCountry(input.country)) return { ok: false, error: "Pick where you work from." };

  try {
    // The same limit the quote generator uses. This is a web search on a
    // Sonnet call, so it is the expensive kind of button.
    await enforceLlmRateLimit(user.id);

    const answer = await getOrResearchMarketRate({
      country: input.country,
      industry: user.industry,
      currency: input.currency || "USD",
      rateUnit: parseRateUnit(input.rateUnit),
    });

    // Remembered here rather than in a separate step, so the country the quote
    // is priced against is the one they just chose.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...({ country: input.country, expertiseLevel: level } as Record<string, unknown>),
      },
    });

    if (!answer.levels) {
      // The prose survived and the numbers did not, which is worth saying
      // rather than hiding: the paragraph still answers the question, it just
      // cannot be pressed.
      return {
        ok: true,
        data: {
          options: [],
          suggested: 0,
          note: answer.note,
          country: countryName(input.country) ?? input.country,
        },
      };
    }

    return {
      ok: true,
      data: {
        options: pickThree(answer.levels[level]),
        suggested: midpoint(answer.levels[level]),
        note: answer.note,
        country: countryName(input.country) ?? input.country,
      },
    };
  } catch (err) {
    console.error("[researchRateAction] failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't research a rate right now.",
    };
  }
}
