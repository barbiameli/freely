"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/sanitize-text";
import type { ActionResult } from "@/actions/briefs";

/**
 * Records a client accepting a published quote.
 *
 * This is a simple electronic signature: a typed name, an explicit tick, and
 * a timestamp, which is how the large majority of freelance engagements are
 * actually agreed. It is weaker evidence than a dedicated e-signature
 * provider, which produces a signing certificate and a full audit trail, so
 * it is not the right tool for a high-value contract where that matters.
 *
 * Deliberately unauthenticated: the client has a link, not an account. That
 * means the only thing standing between a stranger and an acceptance is the
 * unguessable slug, so we record what we can about who did it and refuse to
 * overwrite an acceptance that already exists.
 */
export async function acceptQuoteAction(
  publicSlug: string,
  name: string,
  email: string
): Promise<ActionResult<{ acceptedAt: string }>> {
  const cleanName = sanitizeText(name).trim();
  const cleanEmail = sanitizeText(email).trim();

  if (cleanName.length < 2) {
    return { ok: false, error: "Please type your full name to accept." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: "Please add a valid email address." };
  }

  // The acceptance columns exist in schema.prisma, but the generated Prisma
  // client in this sandbox predates them (no network access to re-run
  // `prisma generate`), so these two calls are cast. The build regenerates the
  // client properly, at which point the casts become redundant rather than
  // load-bearing.
  // Fetched without a `select` on purpose: narrowing it to the columns the
  // stub knows about would mean acceptedAt was never actually loaded, and the
  // already-accepted guard below would silently never fire.
  const brief = (await prisma.brief.findUnique({
    where: { publicSlug },
  })) as { id: string; published: boolean; acceptedAt: Date | null } | null;
  if (!brief || !brief.published) {
    return { ok: false, error: "This quote isn't available." };
  }
  if (brief.acceptedAt) {
    return { ok: false, error: "This quote has already been accepted." };
  }

  // Vercel sits behind a proxy, so the client address arrives in
  // x-forwarded-for as a comma-separated chain; the first entry is the client.
  const forwarded = headers().get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || null;

  const acceptedAt = new Date();
  await prisma.brief.update({
    where: { id: brief.id },
    data: {
      acceptedAt,
      acceptedName: cleanName,
      acceptedEmail: cleanEmail,
      acceptedIp: ip,
    } as unknown as Parameters<typeof prisma.brief.update>[0]["data"],
  });

  revalidatePath(`/q/${publicSlug}`);
  return { ok: true, data: { acceptedAt: acceptedAt.toISOString() } };
}
