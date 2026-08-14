import crypto from "crypto";
import { isTransactional, type EmailKind } from "@/lib/email-kinds";

/**
 * Who may be sent marketing email.
 *
 * One rule, and it is not a preference: marketing goes only to somebody who
 * ticked a box themselves, and everything else goes regardless. A password
 * reset does not consult a mailing list setting, and a mailing list does not
 * get to borrow the reset's permission.
 *
 * That is enforced in send() rather than left to each caller, because it is the
 * kind of rule that is followed everywhere until the one place somebody was in a
 * hurry, and the cost of that one place is a complaint to a regulator rather
 * than a bug report.
 */

export interface ConsentState {
  marketingOptIn: boolean;
  marketingOptInAt: Date | null;
}

/**
 * Whether this kind of message may go to this person.
 *
 * Transactional mail ignores consent entirely, which is correct and worth being
 * explicit about: somebody who unsubscribes from product news has not asked to
 * stop being told their password changed.
 */
export function maySend(kind: EmailKind, consent: ConsentState | null): boolean {
  if (isTransactional(kind)) return true;
  return Boolean(consent?.marketingOptIn && consent.marketingOptInAt);
}

/**
 * A record of consent, for the moment somebody ticks the box.
 *
 * Stored with a time and a source because consent is a claim that has to be
 * supportable: "they agreed" is not an answer to "when, and to what". Only ever
 * called from a real interaction, never from a default.
 */
export function grant(source: "signup" | "account", now = new Date()) {
  return {
    marketingOptIn: true,
    marketingOptInAt: now,
    marketingOptInSource: source,
  };
}

/**
 * Withdrawing it.
 *
 * The timestamp is cleared along with the flag, so a later opt-in records its
 * own date rather than inheriting an old one, and nothing can read a stale
 * consent date as current.
 */
export function withdraw() {
  return {
    marketingOptIn: false,
    marketingOptInAt: null,
    marketingOptInSource: null,
  };
}

/**
 * The token in an unsubscribe link.
 *
 * Random rather than derived from the user id, so the link cannot be worked out
 * for somebody else's address from a pattern. Rotated when it is used, which
 * means an old email cannot be replayed to change somebody's mind back.
 */
export function newUnsubscribeToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}
