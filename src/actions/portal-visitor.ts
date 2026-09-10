"use server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";
import { appUrl, send } from "@/lib/email";
import { newToken, visitorIdFromCookie } from "@/lib/portal-session";
import type { ActionResult } from "@/actions/briefs";

/**
 * Asking a client who they are, without making them an account.
 *
 * They type an address, they get a link, clicking it remembers them. No
 * password, so nothing to reset and nothing to leak; and nothing here grants
 * access to the portal, which the link they were sent already did. What it
 * grants is being known: the freelancer sees who has looked, and the welcome
 * pack can stop leading once this particular person has read it.
 *
 * Which is also why this is unauthenticated and rate limited. Anybody holding
 * a portal link can make it send an email, so the limit is per portal rather
 * than per address: twenty in a minute is a script, and one client mistyping
 * their own address twice is not.
 */

const LIMIT = 20;
const WINDOW_MS = 60_000;
/** An hour. Long enough to find the email, short enough that a forwarded one
 * has usually stopped working. */
const TOKEN_MS = 60 * 60 * 1000;

const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function db() {
  return prisma as unknown as {
    client: {
      findUnique(args: {
        where: { publicSlug: string };
      }): Promise<{ id: string; name: string; published: boolean } | null>;
    };
    portalVisitor: {
      upsert(args: {
        where: { clientId_email: { clientId: string; email: string } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }): Promise<{ id: string }>;
    };
    portalToken: {
      create(args: { data: Record<string, unknown> }): Promise<{ token: string }>;
    };
  };
}

export async function requestPortalLinkAction(
  slug: string,
  email: string,
  name: string
): Promise<ActionResult<undefined>> {
  const cleaned = email.trim().toLowerCase();
  if (!SHAPE.test(cleaned) || cleaned.length > 254) {
    return { ok: false, error: "portal.badEmail" };
  }

  try {
    await checkRateLimit("portal-link", slug, { limit: LIMIT, windowMs: WINDOW_MS });

    const client = await db().client.findUnique({ where: { publicSlug: slug } });
    /*
     * The same answer whether the portal is missing, switched off, or fine.
     *
     * This endpoint takes an unguessable slug from an unauthenticated caller.
     * Telling a wrong slug apart from a right one turns it into a way of
     * testing whether a portal exists.
     */
    if (!client || !client.published) return { ok: true, data: undefined };

    const visitor = await db().portalVisitor.upsert({
      where: { clientId_email: { clientId: client.id, email: cleaned } },
      create: { clientId: client.id, email: cleaned, name: name.trim().slice(0, 80) },
      // Their name, if they have given a better one this time. Not the
      // verification: that belongs to the link, not to asking for one.
      update: name.trim() ? { name: name.trim().slice(0, 80) } : {},
    });

    const token = newToken();
    await db().portalToken.create({
      data: { visitorId: visitor.id, token, expiresAt: new Date(Date.now() + TOKEN_MS) },
    });

    const link = `${appUrl()}/c/${slug}/hello/${token}`;
    await send(
      {
        to: cleaned,
        subject: `Your link to ${client.name}`,
        // Deliberately plain. This is a link somebody asked for ten seconds
        // ago; anything longer reads as marketing and lands in a spam folder.
        lines: [
          `It works once and expires in an hour.`,
          `If you did not ask for it, nothing has happened and you can ignore this.`,
        ],
        action: { label: "Open your page", url: link },
      },
      { kind: "PORTAL_LINK" }
    );

    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, error: "portal.tooMany" };
    return { ok: false, error: "portal.failed" };
  }
}

/**
 * "Got it" on the welcome pack.
 *
 * Identified by the cookie rather than by anything passed in, so this cannot
 * be used to mark somebody else as having read the rules. If there is no
 * cookie there is nobody to record it against, and the answer is a quiet yes:
 * the caller is a browser that has just collapsed a card, and telling it off
 * for not being logged in would be a strange thing to do.
 */
export async function markOnboardingSeenAction(slug: string): Promise<ActionResult<undefined>> {
  const visitorId = visitorIdFromCookie(slug);
  if (!visitorId) return { ok: true, data: undefined };

  try {
    const client = await db().client.findUnique({ where: { publicSlug: slug } });
    if (!client || !client.published) return { ok: true, data: undefined };

    await (
      prisma as unknown as {
        portalVisitor: {
          updateMany(args: {
            where: { id: string; clientId: string };
            data: Record<string, unknown>;
          }): Promise<unknown>;
        };
      }
    ).portalVisitor.updateMany({
      // Scoped to this portal's client, so a cookie from one portal cannot
      // write against a visitor row belonging to another.
      where: { id: visitorId, clientId: client.id },
      data: { onboardingSeenAt: new Date() },
    });
    return { ok: true, data: undefined };
  } catch {
    // Nothing worth telling anybody. Worst case they are shown the welcome
    // pack once more.
    return { ok: true, data: undefined };
  }
}
