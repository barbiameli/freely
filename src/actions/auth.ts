"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type SignUpResult = { ok: true } | { ok: false; error: string };

/**
 * Open sign-up — anyone can create their own separate Freely account/studio.
 * Basic info only (name, optional studio name) is collected here; nothing
 * more invasive yet. Teammates can still be added to an existing studio
 * afterward via a Team invite (see actions/team.ts), which is a distinct
 * flow from this one.
 */
export async function signUpAction(formData: FormData): Promise<SignUpResult> {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();
  const studioName = String(formData.get("studioName") || "").trim();

  if (!email || !password || !name) {
    return { ok: false, error: "Name, email, and password are required." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, passwordHash, name, studioName: studioName || null },
  });

  return { ok: true };
}
