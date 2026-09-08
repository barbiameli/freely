"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";
import type { ActionResult } from "@/actions/briefs";

/**
 * Joining the list while the beta is closed.
 *
 * The only unauthenticated write in the app that takes an address, so it is
 * the one place somebody can push rows into the database without an account.
 * It is rate limited per address for that reason, at a limit generous enough
 * that a person who mistypes their email twice is not locked out.
 */

/**
 * Reaching the Waitlist table.
 *
 * Through a narrow shape rather than by name, in the same way as the client
 * and invoice reads: the model is newer than the generated client in some
 * environments, and a named call would not compile there. Contained in this
 * one function so nothing else has to know.
 */
function table() {
  return (
    prisma as unknown as {
      waitlist: {
        upsert(args: {
          where: { email: string };
          create: { email: string; locale: string };
          update: Record<string, never>;
        }): Promise<{ id: string }>;
      };
    }
  ).waitlist;
}

/** Twenty a minute from one address, which is a script rather than a person. */
const LIMIT = 20;
const WINDOW_MS = 60_000;

/**
 * Good enough, deliberately.
 *
 * Something before an @, something after it, a dot, and something after that.
 * A stricter pattern rejects real addresses, and the only test that settles
 * whether an address works is sending to it. Nothing downstream depends on
 * this being exact.
 */
const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function joinWaitlistAction(
  email: string,
  locale: string
): Promise<ActionResult<undefined>> {
  const cleaned = email.trim().toLowerCase();
  if (!SHAPE.test(cleaned) || cleaned.length > 254) {
    return { ok: false, error: "wait.badEmail" };
  }

  try {
    // Vercel sits behind a proxy, so the client address arrives in
    // x-forwarded-for as a comma-separated chain; the first entry is the client.
    const forwarded = headers().get("x-forwarded-for") || "";
    const ip = forwarded.split(",")[0].trim() || "unknown";
    await checkRateLimit("waitlist", ip, { limit: LIMIT, windowMs: WINDOW_MS });

    /*
     * An address already on the list is a success, not a clash.
     *
     * Two reasons. Somebody who signed up last month and has forgotten wants
     * to be told they are on it, rather than told off. And an error that only
     * appears for addresses already in the table turns this form into a way
     * of asking whether a given person uses Freely, which is not a question a
     * public page should answer.
     */
    await table().upsert({
      where: { email: cleaned },
      create: { email: cleaned, locale: locale === "es" ? "es" : "en" },
      // Nothing worth changing. The original date is the useful one, since it
      // is the order the list gets worked through in.
      update: {},
    });

    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { ok: false, error: "wait.tooMany" };
    }
    return { ok: false, error: "wait.failed" };
  }
}
