"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withRate } from "@/lib/discipline-rates";
import { allDisciplines } from "@/lib/industries";
import { requireFullUser } from "@/lib/session";
import {
  learn,
  keep,
  type DefaultsPatch,
  type QuoteSetup,
  type SetupRowKey,
} from "@/lib/quote-defaults";

/**
 * Remembering the quote setup.
 *
 * Two ways in, and the difference between them is who asked. `learnAfterQuote`
 * fills in what has never been decided, silently, so the second quote is
 * shorter than the first without anybody visiting a settings page. `keepRow`
 * overwrites one row, and only ever runs because somebody pressed "make this
 * my usual".
 *
 * Nothing here is worth failing a quote over: if the write fails, the quote is
 * already generated and the worst outcome is being asked again next time.
 */

/** The account columns these read, all newer than the generated client here. */
type UserDefaults = Record<string, unknown>;

async function currentDefaults(userId: string): Promise<UserDefaults> {
  const row = (await prisma.user.findUnique({
    where: { id: userId },
    // No select: these columns are newer than the generated Prisma client in
    // this workspace, so narrowing would return them as undefined and every
    // row would look undecided. See lib/track-db for the same situation.
  })) as unknown as UserDefaults | null;
  return row ?? {};
}

async function writeDefaults(userId: string, patch: DefaultsPatch): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: patch as unknown as Record<string, never>,
  });
}

/**
 * After a quote is generated, remember anything that had never been decided.
 *
 * Called without awaiting. A quote that generated fine must not show an error
 * because a preference could not be saved.
 */
export async function learnQuoteDefaultsAction(
  setup: QuoteSetup
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireFullUser();
    const saved = await currentDefaults(user.id);
    await writeDefaults(user.id, learn(setup, saved));
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that as your usual." };
  }
}

/** "Make this my usual", for one row. */
export async function keepQuoteDefaultAction(
  row: SetupRowKey,
  setup: QuoteSetup
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireFullUser();
    await writeDefaults(user.id, keep(row, setup));
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that as your usual." };
  }
}

/**
 * Everything the Memory page edits directly.
 *
 * Separate from `keepRow` because Memory is where a decision is revisited on
 * purpose, so it writes exactly what it was given with no learning rules
 * involved.
 */
export async function saveQuoteSetupAction(
  patch: DefaultsPatch & {
    expertiseLevel?: string | null;
    /**
     * A rate for one of the other kinds of work they do.
     *
     * Sent instead of defaultRate when Memory is showing a discipline that is
     * not their main one, because defaultRate belongs to the main one and
     * overwriting it here would quietly reprice every quote they write.
     */
    rateForDiscipline?: { discipline: string; rate: number; unit: string } | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireFullUser();
    const { rateForDiscipline, ...rest } = patch;
    await writeDefaults(user.id, rest as DefaultsPatch);

    if (rateForDiscipline && rateForDiscipline.rate > 0) {
      // Only a discipline they actually said they do. The key arrives from the
      // client, and a Json column will store whatever it is handed.
      const mine = allDisciplines(
        user.industry,
        (user as unknown as { otherIndustries?: string[] }).otherIndustries
      );
      if (mine.includes(rateForDiscipline.discipline)) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            ratesByDiscipline: withRate(
              (user as unknown as { ratesByDiscipline?: unknown }).ratesByDiscipline,
              rateForDiscipline.discipline,
              {
                rate: rateForDiscipline.rate,
                unit: rateForDiscipline.unit === "DAY" || rateForDiscipline.unit === "FIXED"
                  ? rateForDiscipline.unit
                  : "HOUR",
              }
            ) as unknown as Prisma.InputJsonValue,
          } as unknown as Parameters<typeof prisma.user.update>[0]["data"],
        });
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that." };
  }
}
