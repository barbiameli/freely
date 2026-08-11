/**
 * Which quotes to ask about, and what the answers add up to.
 *
 * The prompt on the quotes list and the win rate on the same page are the same
 * data seen twice, so the rules for both live here rather than in the
 * component. Pure functions: no Prisma, no React, so the awkward cases can be
 * tested directly.
 */

export type QuoteOutcome = "PENDING" | "WON" | "LOST";

export interface QuoteForPrompt {
  id: string;
  title: string;
  client: string;
  price: number;
  currency?: string | null;
  createdAt: Date;
  outcome: QuoteOutcome;
  /** Whether the client signed it on the public page. */
  acceptedAt?: Date | null;
  /** Whether it is already a project. */
  tracked: boolean;
}

/**
 * A quote is worth asking about once it has had time to be answered.
 *
 * Asking the same afternoon it was sent is asking someone to predict the
 * future, and worse, it trains them to close the prompt. Two days is long
 * enough that a fast yes has usually arrived and short enough that the job is
 * still fresh in mind.
 */
export const ASK_AFTER_DAYS = 2;

/** Beyond this the answer is guesswork, and a stale nag is worse than none. */
export const STOP_ASKING_AFTER_DAYS = 90;

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000;
}

/**
 * The quotes to put in the prompt.
 *
 * Deliberately excludes anything already answered, anything signed on its
 * public page (that answers itself, and auto-tracks), and anything dismissed.
 * Newest first, because the most recent quote is the one whose outcome is most
 * likely to be known and least likely to have been forgotten.
 */
export function quotesToAskAbout(
  quotes: QuoteForPrompt[],
  now: Date,
  dismissedAt?: Date | null
): QuoteForPrompt[] {
  return quotes
    .filter((q) => {
      if (q.outcome !== "PENDING") return false;
      // A signature is an answer. Asking after one would be asking something
      // we already know, which reads as the app not paying attention.
      if (q.acceptedAt) return false;

      const age = daysBetween(q.createdAt, now);
      if (age < ASK_AFTER_DAYS || age > STOP_ASKING_AFTER_DAYS) return false;

      // Closing the prompt hides what was in it, not everything forever.
      if (dismissedAt && q.createdAt <= dismissedAt) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export interface WinRate {
  won: number;
  lost: number;
  /** 0 to 1, or null when nothing has been decided yet. */
  rate: number | null;
}

/**
 * How many of the decided quotes were won.
 *
 * Pending quotes are excluded from the denominator on purpose. Counting them
 * as losses would make a freelancer who quotes a lot look worse than one who
 * quotes rarely, which is the opposite of true.
 */
export function winRate(quotes: { outcome: QuoteOutcome }[]): WinRate {
  const won = quotes.filter((q) => q.outcome === "WON").length;
  const lost = quotes.filter((q) => q.outcome === "LOST").length;
  const decided = won + lost;
  return { won, lost, rate: decided === 0 ? null : won / decided };
}

/**
 * Whether a win rate is worth showing.
 *
 * One win out of one is 100% and means nothing. Below this it is noise
 * presented as a statistic, which is worse than no statistic.
 */
export const MIN_DECIDED_FOR_RATE = 4;

export function showWinRate(rate: WinRate): boolean {
  return rate.won + rate.lost >= MIN_DECIDED_FOR_RATE;
}
