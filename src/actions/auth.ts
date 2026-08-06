"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type SignUpResult = { ok: true } | { ok: false; error: string };

/**
 * Open sign-up is only for bootstrapping the very first account (the studio
 * owner). Every account after that is created by redeeming a team invite
 * (see actions/team.ts) — a teammate can't just sign themselves up.
 */
export async function signUpAction(formData: FormData): Promise<SignUpResult> {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    return {
      ok: false,
      error:
        "An account already exists for this studio. Sign in instead, or ask the studio owner for a Team invite link.",
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { email, passwordHash } });

  return { ok: true };
}

export async function canSignUp(): Promise<boolean> {
  const count = await prisma.user.count();
  return count === 0;
}
