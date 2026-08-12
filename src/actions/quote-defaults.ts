"use server";

import { prisma } from "@/lib/prisma";
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
  patch: DefaultsPatch & { expertiseLevel?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireFullUser();
    await writeDefaults(user.id, patch as DefaultsPatch);
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that." };
  }
}
