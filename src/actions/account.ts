"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireFullUser } from "@/lib/session";
import { parseLocale } from "@/lib/i18n";
import type { ActionResult } from "@/actions/briefs";

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
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    // The generated client here predates the column; see lib/track-db.
    data: { locale: parseLocale(locale) } as unknown as Parameters<
      typeof prisma.user.update
    >[0]["data"],
  });
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
