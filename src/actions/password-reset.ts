"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/lib/mail-db";
import { send, appUrl } from "@/lib/email";
import {
  newResetToken,
  hashToken,
  checkReset,
  expiryFrom,
  tooManyRequests,
  passwordProblem,
  MIN_PASSWORD_LENGTH,
  REQUEST_WINDOW_MS,
} from "@/lib/password-reset";
import type { ActionResult } from "@/actions/briefs";

/**
 * Forgetting a password, and getting back in.
 *
 * The rule running through all of this: the pages must behave identically
 * whether or not the address has an account. Same message, same timing, same
 * everything. A form that says "no account with that email" is a way to find
 * out who has signed up, and for a tool freelancers keep their client list in,
 * that is worth more to somebody than it first appears.
 *
 * So requestReset always reports success. The only thing that varies is whether
 * an email actually goes out, and that is invisible from the outside.
 */

const RESETS_PER_HOUR_TEXT = "Too many attempts. Try again in an hour.";

export async function requestPasswordResetAction(
  email: string
): Promise<ActionResult<undefined>> {
  const address = email.trim().toLowerCase();
  if (!address || !address.includes("@")) {
    return { ok: false, error: "Enter the email address you signed up with." };
  }

  const user = await prisma.user.findUnique({ where: { email: address } });

  // No account, or an account that only ever signed in with Google and has no
  // password to reset. Both stop here, and both look exactly like success.
  if (!user || !user.passwordHash) return { ok: true, data: undefined };

  const recent = await resetDb.findMany({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - REQUEST_WINDOW_MS) } },
    select: { createdAt: true },
  });
  if (tooManyRequests(recent.map((r) => r.createdAt))) {
    // The one case worth saying out loud, since somebody hitting this is
    // usually the account's owner wondering why nothing arrived.
    return { ok: false, error: RESETS_PER_HOUR_TEXT };
  }

  const token = newResetToken();
  await resetDb.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: expiryFrom() },
  });

  await send(
    {
      to: user.email,
      subject: "Reset your Freely password",
      lines: [
        `Someone asked to reset the password for ${user.email}.`,
        "The link below works once and expires in an hour.",
        "If this was not you, nothing has changed and you can ignore this.",
      ],
      action: { label: "Set a new password", url: `${appUrl()}/reset/${token}` },
    },
    { kind: "PASSWORD_RESET", userId: user.id }
  );

  return { ok: true, data: undefined };
}

/**
 * Whether a link is still good, for the page to decide what to render.
 *
 * Says only yes or no. Which of the three reasons it failed is in the database
 * and is nobody's business at the door: "expired" confirms a real reset once
 * existed for that account, which "unknown" does not.
 */
export async function checkResetTokenAction(token: string): Promise<{ valid: boolean }> {
  const stored = await resetDb.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { tokenHash: true, expiresAt: true, usedAt: true },
  });
  return { valid: checkReset(stored).ok };
}

/**
 * Setting the new password.
 *
 * Spends every outstanding reset for the account before writing the new
 * password, so a double-submitted form cannot use one link twice and three
 * requests do not leave two live keys.
 */
export async function resetPasswordAction(
  token: string,
  password: string
): Promise<ActionResult<{ email: string }>> {
  if (passwordProblem(password)) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const tokenHash = hashToken(token);
  const stored = await resetDb.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, tokenHash: true, expiresAt: true, usedAt: true },
  });

  const check = checkReset(stored);
  if (!check.ok || !stored) {
    return {
      ok: false,
      error: "That link has expired or has already been used. Ask for a new one.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // Spend the tokens first, then set the password. If the second write fails,
  // the links are dead and the old password still works, which is a bad
  // afternoon. The other order leaves a live reset link next to a changed
  // password, which is an open door.
  //
  // Every outstanding reset for this account, not just the one clicked: three
  // requests because the first two seemed lost must not leave two live keys.
  await resetDb.updateMany({
    where: { userId: stored.userId, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) return { ok: false, error: "Something went wrong. Ask for a new link." };
  {
    // Not a courtesy. If this was not them, this email is how they find out,
    // and it is the only warning they will get.
    await send(
      {
        to: user.email,
        subject: "Your Freely password was changed",
        lines: [
          "The password on your Freely account was just changed.",
          "If that was you, there is nothing to do.",
          "If it was not, reset it again straight away and the old one stops working.",
        ],
        action: { label: "Reset it again", url: `${appUrl()}/forgot` },
      },
      { kind: "PASSWORD_RESET", userId: user.id }
    );
  }

  // The address is returned so the page can sign them in without asking for it
  // again. Whoever completed this reset read that mailbox, so it tells them
  // nothing they did not already know.
  return { ok: true, data: { email: user.email } };
}
