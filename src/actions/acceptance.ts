"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/sanitize-text";
import { send, appUrl } from "@/lib/email";
import { currencySymbol } from "@/lib/currencies";
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
  })) as {
    id: string;
    published: boolean;
    acceptedAt: Date | null;
    userId: string;
    title: string;
    price: number;
    currency: string;
  } | null;
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

  // Telling the freelancer. Until now the only way to find out a quote had been
  // accepted was to open it, which means a client can agree to a job and nobody
  // knows.
  //
  // After the update and deliberately not awaited into the result: the
  // acceptance is already recorded, so a client clicking "accept" must not see
  // an error because an email provider was having a bad morning. send() never
  // throws and logs its own failures.
  const owner = await prisma.user.findUnique({
    where: { id: brief.userId },
    select: { email: true },
  });
  if (owner?.email) {
    const amount = brief.price
      ? `${currencySymbol(brief.currency)}${brief.price.toLocaleString()}`
      : "";
    await send({
      to: owner.email,
      subject: `${cleanName} accepted your quote`,
      lines: [
        `${cleanName} has accepted "${brief.title}".`,
        [amount, `Accepted ${acceptedAt.toLocaleDateString("en-GB")} by ${cleanEmail}.`]
          .filter(Boolean)
          .join(" · "),
      ],
      action: { label: "Open the quote", url: `${appUrl()}/quote/${brief.id}` },
    });
  }

  revalidatePath(`/q/${publicSlug}`);
  return { ok: true, data: { acceptedAt: acceptedAt.toISOString() } };
}
