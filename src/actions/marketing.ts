"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { grant, withdraw, newUnsubscribeToken } from "@/lib/marketing";
import type { ActionResult } from "@/actions/briefs";

/**
 * Consent, and the ways it changes.
 *
 * Three entry points, and they are separate on purpose. Signing up records
 * consent alongside an account being made; the account page changes it
 * deliberately; the unsubscribe link withdraws it without signing in, which is
 * the only kind of unsubscribe that is any use, since the whole point is that
 * this person does not want to deal with you.
 */

/** From the account page. Signed in, so this is the person's own choice. */
export async function setMarketingOptInAction(on: boolean): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...((on ? grant("account") : withdraw()) as Record<string, unknown>),
      // Made on the way in, so the link in the first email works.
      ...(on ? ({ unsubscribeToken: newUnsubscribeToken() } as Record<string, unknown>) : {}),
    },
  });
  revalidatePath("/account");
  return { ok: true, data: undefined };
}

/** The nudges, which are not marketing and have their own switch. */
export async function setNudgeEmailsAction(on: boolean): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { ...({ nudgeEmails: on } as Record<string, unknown>) },
  });
  revalidatePath("/account");
  return { ok: true, data: undefined };
}

/**
 * Unsubscribing from a link, with no session.
 *
 * The token is rotated on use, so the same link cannot be replayed later to
 * change somebody's mind back, and an old email in an archive stops being a
 * live control over their preferences.
 *
 * Reports success for a token it does not recognise. An unsubscribe page that
 * says "no such subscriber" is a way to test whether an address is on the list,
 * and the person clicking it wanted to stop hearing from us either way.
 */
export async function unsubscribeAction(token: string): Promise<{ ok: true }> {
  const user = (await prisma.user.findFirst({
    where: { ...({ unsubscribeToken: token } as Record<string, unknown>) },
  })) as unknown as { id: string } | null;

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(withdraw() as Record<string, unknown>),
        ...({ unsubscribeToken: newUnsubscribeToken() } as Record<string, unknown>),
      },
    });
  }
  return { ok: true };
}
