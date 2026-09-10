"use server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";
import { appUrl, send } from "@/lib/email";
import { newToken, setVisitorCookie, visitorIdFromCookie } from "@/lib/portal-session";
import {
  checkPassword,
  hashPassword,
  passwordProblem,
  visitors,
  type PortalVisitorRow,
} from "@/lib/portal-auth";
import type { ActionResult } from "@/actions/briefs";

/**
 * Getting into a Client Portal.
 *
 * The portal is gated and access is by invitation, so everything here answers
 * the same question: is this person one of the people the freelancer added?
 * Two ways to prove it, a password or a link to the address on the invitation,
 * and both end in the same cookie.
 *
 * Every failure says the same thing. "No such address", "wrong password" and
 * "not invited" are one message, because a sign-in form that distinguishes
 * them is a way of finding out who a freelancer's clients are, and the URL is
 * already in the hands of whoever is typing.
 */

/** Per portal, not per address: the attacker chooses the address. */
const LIMIT = 15;
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
      }): Promise<{ id: string; name: string; published: boolean; userId: string } | null>;
    };
    portalToken: {
      create(args: { data: Record<string, unknown> }): Promise<{ token: string }>;
      findUnique(args: { where: { token: string } }): Promise<{
        id: string;
        visitorId: string;
        expiresAt: Date;
        usedAt: Date | null;
      } | null>;
      update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    };
  };
}

/** The portal, if it is real and switched on. */
async function livePortal(slug: string) {
  const client = await db().client.findUnique({ where: { publicSlug: slug } });
  return client && client.published ? client : null;
}

/**
 * Sending a link to somebody who was invited.
 *
 * Returns success whatever happens. An address that is not on the list is told
 * the same thing as one that is, because the alternative turns this into a way
 * of testing whether a given person works with a given freelancer.
 */
export async function requestPortalLinkAction(
  slug: string,
  email: string
): Promise<ActionResult<undefined>> {
  const cleaned = email.trim().toLowerCase();
  if (!SHAPE.test(cleaned)) return { ok: false, error: "portal.badEmail" };

  try {
    await checkRateLimit("portal-link", slug, { limit: LIMIT, windowMs: WINDOW_MS });

    const client = await livePortal(slug);
    if (!client) return { ok: true, data: undefined };

    const visitor = await visitors().findFirst({
      where: { clientId: client.id, email: cleaned },
    });
    // Not invited. Nothing sent, nothing said.
    if (!visitor) return { ok: true, data: undefined };

    const token = newToken();
    await db().portalToken.create({
      data: { visitorId: visitor.id, token, expiresAt: new Date(Date.now() + TOKEN_MS) },
    });

    await send(
      {
        to: cleaned,
        subject: `Your link to ${client.name}`,
        lines: [
          `It works once and expires in an hour.`,
          `If you did not ask for it, nothing has happened and you can ignore this.`,
        ],
        action: { label: "Sign in", url: `${appUrl()}/c/${slug}/hello/${token}` },
      },
      { kind: "PORTAL_LINK" }
    );

    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, error: "portal.tooMany" };
    return { ok: false, error: "portal.failed" };
  }
}

/** Signing in with a password, for somebody who has set one. */
export async function portalSignInAction(
  slug: string,
  email: string,
  password: string
): Promise<ActionResult<undefined>> {
  const cleaned = email.trim().toLowerCase();

  try {
    await checkRateLimit("portal-signin", slug, { limit: LIMIT, windowMs: WINDOW_MS });

    const client = await livePortal(slug);
    let visitor: PortalVisitorRow | null = null;
    if (client) {
      visitor = await visitors().findFirst({ where: { clientId: client.id, email: cleaned } });
    }

    // Runs the comparison even when there is no visitor, so a wrong address
    // and a wrong password take the same time to be refused.
    const ok = await checkPassword(visitor, password);
    if (!ok || !visitor || !client) return { ok: false, error: "portal.wrong" };

    await visitors().update({
      where: { id: visitor.id },
      data: { lastSeenAt: new Date(), verifiedAt: visitor.verifiedAt ?? new Date() },
    });
    setVisitorCookie(slug, visitor.id);
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: false, error: "portal.tooMany" };
    return { ok: false, error: "portal.failed" };
  }
}

/**
 * Choosing a password, once you are already in.
 *
 * Only ever called by somebody holding a valid cookie, which they got by
 * clicking a link sent to their own address. There is no "current password"
 * to ask for because there may not be one yet, and the thing standing in for
 * it is the same thing a reset flow would rely on anyway.
 */
export async function setPortalPasswordAction(
  slug: string,
  password: string
): Promise<ActionResult<undefined>> {
  const visitorId = visitorIdFromCookie(slug);
  if (!visitorId) return { ok: false, error: "portal.signedOut" };
  if (passwordProblem(password)) return { ok: false, error: "portal.shortPassword" };

  try {
    const client = await livePortal(slug);
    if (!client) return { ok: false, error: "portal.failed" };

    await visitors().updateMany({
      // Scoped, so a cookie from one portal cannot set a password on a
      // visitor belonging to another.
      where: { id: visitorId, clientId: client.id },
      data: { passwordHash: await hashPassword(password) },
    });
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "portal.failed" };
  }
}

/** "Got it" on the welcome pack. Identified by the cookie, never by an id
 * passed in, so it cannot be used to mark somebody else as having read it. */
export async function markOnboardingSeenAction(slug: string): Promise<ActionResult<undefined>> {
  const visitorId = visitorIdFromCookie(slug);
  if (!visitorId) return { ok: true, data: undefined };

  try {
    const client = await livePortal(slug);
    if (!client) return { ok: true, data: undefined };
    await visitors().updateMany({
      where: { id: visitorId, clientId: client.id },
      data: { onboardingSeenAt: new Date() },
    });
    return { ok: true, data: undefined };
  } catch {
    // Worst case they are shown the welcome pack once more.
    return { ok: true, data: undefined };
  }
}
