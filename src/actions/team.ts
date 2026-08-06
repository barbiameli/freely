"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import type { ActionResult } from "@/actions/briefs";

/** Creates the user's Team the first time they invite someone — a solo
 * account has no Team row until this runs. Idempotent: if they already own
 * one, just returns it. */
async function ensureOwnedTeam(userId: string, studioName: string) {
  const existing = await prisma.team.findUnique({ where: { ownerId: userId } });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const team = await tx.team.create({ data: { name: studioName, ownerId: userId } });
    await tx.user.update({ where: { id: userId }, data: { teamId: team.id } });
    return team;
  });
}

export async function createInviteAction(
  email: string
): Promise<ActionResult<{ url: string }>> {
  const user = await requireFullUser();
  const team = await ensureOwnedTeam(user.id, `${user.email.split("@")[0]}'s studio`);

  const invite = await prisma.teamInvite.create({
    data: { teamId: team.id, email: email.trim().toLowerCase() || null },
  });

  revalidatePath("/memory");
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return { ok: true, data: { url: `${baseUrl}/invite/${invite.token}` } };
}

export async function listTeamAction() {
  const user = await requireFullUser();
  const teamId = user.teamId ?? (await prisma.team.findUnique({ where: { ownerId: user.id } }))?.id;
  if (!teamId) return { team: null, members: [], pendingInvites: [] };

  const [team, members, pendingInvites] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId } }),
    prisma.user.findMany({ where: { teamId }, select: { id: true, email: true } }),
    prisma.teamInvite.findMany({
      where: { teamId, usedAt: null },
      select: { id: true, email: true, token: true, createdAt: true },
    }),
  ]);

  return { team, members, pendingInvites };
}

export async function revokeInviteAction(inviteId: string): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return { ok: false, error: "Invite not found." };
  const team = await prisma.team.findUnique({ where: { id: invite.teamId } });
  if (!team || team.ownerId !== user.id) return { ok: false, error: "Not your team." };

  await prisma.teamInvite.delete({ where: { id: inviteId } });
  revalidatePath("/memory");
  return { ok: true, data: undefined };
}

export async function removeMemberAction(memberId: string): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const team = await prisma.team.findUnique({ where: { ownerId: user.id } });
  if (!team) return { ok: false, error: "You don't own a team." };
  if (memberId === user.id) return { ok: false, error: "You can't remove yourself." };

  await prisma.user.updateMany({
    where: { id: memberId, teamId: team.id },
    data: { teamId: null },
  });
  revalidatePath("/memory");
  return { ok: true, data: undefined };
}

export type RedeemInviteResult = { ok: true } | { ok: false; error: string };

/** Redeems a team invite token to create a new teammate account. Separate
 * from signUpAction (which only ever creates the very first, team-less
 * account) — this is how every account after the first one gets created. */
export async function redeemInviteAction(
  token: string,
  formData: FormData
): Promise<RedeemInviteResult> {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) return { ok: false, error: "Email and password are required." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  const invite = await prisma.teamInvite.findUnique({ where: { token } });
  if (!invite || invite.usedAt) {
    return { ok: false, error: "This invite link is invalid or has already been used." };
  }
  if (invite.email && invite.email !== email) {
    return { ok: false, error: `This invite was sent to ${invite.email}.` };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "An account with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.create({ data: { email, passwordHash, teamId: invite.teamId } }),
    prisma.teamInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
  ]);

  return { ok: true };
}
