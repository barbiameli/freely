import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Who is looking at a Client Portal.
 *
 * Not an account, and deliberately not built on the app's own auth. A client
 * has no password, cannot sign in anywhere else, and must never end up holding
 * a session that means anything outside the one portal they were sent. Reusing
 * NextAuth here would have made a client a User, which is the kind of shortcut
 * that is fine until the day somebody adds a check for "is signed in" and gets
 * a yes from the wrong sort of person.
 *
 * So: a cookie holding a visitor id and a signature over it, scoped by path to
 * the one portal. A visitor with three of your clients' links has three
 * cookies and no way to use one on another.
 */

const SECRET = process.env.NEXTAUTH_SECRET ?? "";

/** Ninety days. Long, because being asked who you are twice is the annoyance
 * this exists to remove, and the thing being protected is a page the holder of
 * the link can already read. */
const MAX_AGE = 60 * 60 * 24 * 90;

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

/**
 * Constant-time, and length-checked first.
 *
 * `timingSafeEqual` throws on a length mismatch rather than returning false,
 * so a forged cookie of the wrong length would be a 500 instead of a no.
 */
function matches(value: string, signature: string): boolean {
  const expected = Buffer.from(sign(value));
  const given = Buffer.from(signature);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

/** Scoped to the one portal, so a cookie is useless anywhere else. */
function cookieName(slug: string): string {
  return `portal_${slug}`;
}

export function newToken(): string {
  // 32 bytes. The token is the entire credential in the email, so it is sized
  // to be worth nothing to a guesser rather than to be typed out.
  return randomBytes(32).toString("hex");
}

/** Remembers this visitor on this device, for this portal only. */
export function setVisitorCookie(slug: string, visitorId: string): void {
  cookies().set(cookieName(slug), `${visitorId}.${sign(visitorId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/c/${slug}`,
    maxAge: MAX_AGE,
  });
}

/**
 * The visitor id this browser is carrying, if the signature holds.
 *
 * Returns null rather than throwing on anything malformed. A cookie is
 * attacker-controlled input and every failure here means the same thing: we do
 * not know who this is, so treat them as nobody.
 */
export function visitorIdFromCookie(slug: string): string | null {
  if (!SECRET) return null;
  const raw = cookies().get(cookieName(slug))?.value;
  if (!raw) return null;
  const split = raw.lastIndexOf(".");
  if (split < 1) return null;
  const id = raw.slice(0, split);
  const signature = raw.slice(split + 1);
  return matches(id, signature) ? id : null;
}

export function clearVisitorCookie(slug: string): void {
  cookies().delete({ name: cookieName(slug), path: `/c/${slug}` });
}
