import crypto from "crypto";

/**
 * The rules a password reset has to follow.
 *
 * Separated from the database and the mail so the parts that decide whether a
 * link is still good can be tested. Everything here is deliberately unforgiving,
 * because this flow is the one place in the app where getting it slightly wrong
 * hands somebody else an account.
 *
 * Four properties, and each exists because the obvious implementation lacks it:
 *
 * The token is random and long. Anything derived from the user, the time, or a
 * counter can be guessed by somebody who knows when they requested it.
 *
 * Only its hash is stored. A leaked backup of the table is then useless, where
 * storing the plaintext would be a list of live keys to every account with a
 * reset outstanding.
 *
 * It expires soon and is spent on use. An old reset email sitting in an inbox
 * is a working key to the account for as long as it remains valid, and mailboxes
 * outlive the intent behind them.
 *
 * And it is compared in constant time, since a comparison that returns early
 * leaks how much of a guess was right.
 */

/** An hour. Long enough to find the email, short enough that a forgotten one
 * stops being a key by lunchtime. */
export const RESET_TTL_MS = 60 * 60 * 1000;

/** How many resets one address can ask for in the window below. */
export const MAX_REQUESTS = 5;
export const REQUEST_WINDOW_MS = 60 * 60 * 1000;

/** 32 bytes, url-safe. Long enough that guessing is not a strategy. */
export function newResetToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** What goes in the database. The plaintext exists only in the email and in the
 * URL the person clicks. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time comparison.
 *
 * Lookup is by hash so this is belt and braces, but a reset flow is the wrong
 * place to rely on one layer.
 */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, which would itself be a signal.
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export interface StoredReset {
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export type ResetProblem = "unknown" | "expired" | "used";

/**
 * Whether a link still opens the account.
 *
 * Returns why it does not, for the log rather than for the person: telling
 * somebody a token is "expired" rather than "unknown" confirms that a real
 * reset existed for that account.
 */
export function checkReset(
  stored: StoredReset | null,
  now = new Date()
): { ok: true } | { ok: false; problem: ResetProblem } {
  if (!stored) return { ok: false, problem: "unknown" };
  if (stored.usedAt) return { ok: false, problem: "used" };
  if (stored.expiresAt.getTime() <= now.getTime()) return { ok: false, problem: "expired" };
  return { ok: true };
}

/** When a token created now should stop working. */
export function expiryFrom(now = new Date()): Date {
  return new Date(now.getTime() + RESET_TTL_MS);
}

/**
 * Whether this address has asked too often.
 *
 * Rate limiting here is not really about load. Without it the form is a way to
 * send somebody else repeated mail, and a way to find out which addresses have
 * accounts by watching how the page behaves.
 */
export function tooManyRequests(recent: Date[], now = new Date()): boolean {
  const since = now.getTime() - REQUEST_WINDOW_MS;
  return recent.filter((d) => d.getTime() > since).length >= MAX_REQUESTS;
}

/**
 * What a new password has to be.
 *
 * Length and nothing else. Composition rules push people towards
 * "Password1!", which is worse than a long thing they can remember, and this is
 * the same bar the signup form sets: a reset that demanded more would be a
 * second, stricter standard nobody was told about.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(password: string): "short" | null {
  return password.length < MIN_PASSWORD_LENGTH ? "short" : null;
}
