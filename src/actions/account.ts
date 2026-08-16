"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireUser, requireFullUser } from "@/lib/session";
import { parseLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/lib/i18n";
import type { ActionResult } from "@/actions/briefs";
import {
  createConnectedAccount,
  onboardingLink,
  dashboardLink,
  connectStatus,
  isConnectAvailable,
} from "@/lib/stripe-connect";
import { appUrl } from "@/lib/email";

/** Updates the basic-info fields collected at signup — kept to just these
 * two, matching the "no data collection yet" scope of signup itself. */
export async function updateAccountAction(patch: {
  name: string;
  studioName: string;
}): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  const name = patch.name.trim();
  if (!name) return { ok: false, error: "Name can't be empty." };

  await prisma.user.update({
    where: { id: user.id },
    data: { name, studioName: patch.studioName.trim() || null },
  });
  revalidatePath("/account");
  return { ok: true, data: undefined };
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult<undefined>> {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return { ok: false, error: "Account not found." };

  if (input.newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }

  if (user.passwordHash) {
    if (!input.currentPassword) {
      return { ok: false, error: "Enter your current password." };
    }
    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) return { ok: false, error: "Current password is incorrect." };
  }
  // Accounts with no passwordHash yet (Google-only sign-in) can set one
  // without proving a current password, since there isn't one.

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  revalidatePath("/account");
  return { ok: true, data: undefined };
}

/** Permanently deletes the signed-in user's account and everything that
 * cascades from it (briefs, projects, memory assets, connections). If they
 * own a Team, members are released (teamId cleared) and the Team itself is
 * removed first, rather than leaving it orphaned or blocking deletion. */
export async function deleteAccountAction(): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();

  await prisma.$transaction(async (tx) => {
    const ownedTeam = await tx.team.findUnique({ where: { ownerId: user.id } });
    if (ownedTeam) {
      await tx.user.updateMany({ where: { teamId: ownedTeam.id }, data: { teamId: null } });
      await tx.team.delete({ where: { id: ownedTeam.id } });
    }
    await tx.user.delete({ where: { id: user.id } });
  });

  return { ok: true, data: undefined };
}

/** Saves the interface language. Stored on the account rather than a cookie,
 * so it follows someone between devices. */
export async function updateLocaleAction(locale: string): Promise<ActionResult<undefined>> {
  const chosen = parseLocale(locale);

  // The cookie first, and for everyone: the marketing page and the sign-in
  // screens are read by people who have no account to store this on yet, and
  // the choice still has to survive to the next page.
  (await cookies()).set(LOCALE_COOKIE, chosen, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    path: "/",
  });

  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      // The generated client here predates the column; see lib/track-db.
      data: { locale: chosen } as unknown as Parameters<
        typeof prisma.user.update
      >[0]["data"],
    });
  }

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Starts, or resumes, linking a freelancer's own Stripe account.
 *
 * One action for both because they are the same click to the person doing it:
 * somebody who left halfway through Stripe's checks comes back to a button that
 * carries on from where they stopped rather than a second account nobody asked
 * for. The account id is saved before the link is built, so an abandoned
 * attempt is resumable rather than orphaned in Stripe with no way back to it.
 */
export async function startStripeConnectAction(): Promise<ActionResult<{ url: string }>> {
  const sessionUser = await requireFullUser();
  if (!isConnectAvailable()) {
    return { ok: false, error: "Online payments aren't available on Freely yet." };
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return { ok: false, error: "Account not found." };

  const stored = user as unknown as { stripeAccountId: string | null };

  try {
    let accountId = stored.stripeAccountId;
    if (!accountId) {
      accountId = await createConnectedAccount(user.email);
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeAccountId: accountId } as unknown as Record<string, unknown>,
      });
    }
    const url = await onboardingLink(accountId, appUrl());
    return { ok: true, data: { url } };
  } catch (err) {
    console.error("[startStripeConnectAction] failed", err);
    return { ok: false, error: "Couldn't reach Stripe just now. Try again in a minute." };
  }
}

/**
 * Asks Stripe whether this account can take money, and records the answer.
 *
 * Called when somebody comes back from onboarding and whenever the settings
 * page is opened. Stripe's checks finish minutes or days after the person
 * returns, and can be undone later, so the flag is refreshed rather than set
 * once and believed.
 */
export async function refreshStripeStatusAction(): Promise<ActionResult<{ ready: boolean }>> {
  const sessionUser = await requireFullUser();
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  const stored = user as unknown as { stripeAccountId: string | null } | null;
  if (!stored?.stripeAccountId) return { ok: true, data: { ready: false } };

  try {
    const status = await connectStatus(stored.stripeAccountId);
    await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        stripeChargesEnabled: status.chargesEnabled,
        // Stamped the first time it comes back clear, and left alone after, so
        // it reads as "connected since" rather than "last checked".
        ...(status.chargesEnabled ? { stripeConnectedAt: new Date() } : {}),
      } as unknown as Record<string, unknown>,
    });
    revalidatePath("/account");
    return { ok: true, data: { ready: status.chargesEnabled } };
  } catch (err) {
    console.error("[refreshStripeStatusAction] failed", err);
    return { ok: false, error: "Couldn't check with Stripe just now." };
  }
}

/** A link into their own Stripe dashboard, for payouts and refunds. */
export async function stripeDashboardAction(): Promise<ActionResult<{ url: string }>> {
  const sessionUser = await requireFullUser();
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  const stored = user as unknown as { stripeAccountId: string | null } | null;
  if (!stored?.stripeAccountId) return { ok: false, error: "No Stripe account linked." };

  try {
    return { ok: true, data: { url: await dashboardLink(stored.stripeAccountId) } };
  } catch (err) {
    console.error("[stripeDashboardAction] failed", err);
    return { ok: false, error: "Couldn't open your Stripe dashboard just now." };
  }
}

/**
 * Unlinks the account from Freely.
 *
 * Freely forgets the id; the Stripe account itself carries on existing, with
 * its history and any pending payouts, because it is theirs and deleting it is
 * not ours to do. Reconnecting later finds the same account.
 */
export async function disconnectStripeAction(): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripeConnectedAt: null,
    } as unknown as Record<string, unknown>,
  });
  revalidatePath("/account");
  return { ok: true, data: undefined };
}
