/**
 * The mailing list, as numbers and as a list of addresses.
 *
 * Freely stores who said yes to product news and what it has sent them. Until
 * now nothing read either: the consent columns were only ever written by the
 * person themselves in Account settings, and EmailLog was written on every send
 * and displayed nowhere. Storing something nobody can look at is the same as
 * not storing it, except for the part where it is still your responsibility.
 *
 * Everything here is a pure function over rows, so the interesting decisions
 * are testable and the page stays a page.
 */

export interface Subscriber {
  email: string;
  since: Date | null;
  source: string | null;
}

export interface SendRow {
  to: string;
  kind: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  createdAt: Date;
  error: string | null;
}

/**
 * The addresses, ready to paste somewhere else.
 *
 * Comma separated, because that is what every mail tool's "paste recipients"
 * box accepts. Deduplicated and lowercased: two accounts can share an address
 * through a team invite, and sending the same person the same email twice is
 * the fastest way to be marked as spam.
 */
export function addressList(subscribers: Subscriber[]): string {
  const seen = new Set<string>();
  for (const s of subscribers) {
    const email = s.email.trim().toLowerCase();
    if (email) seen.add(email);
  }
  return Array.from(seen).join(", ");
}

/** How many distinct people would receive a send. */
export function reach(subscribers: Subscriber[]): number {
  const seen = new Set<string>();
  for (const s of subscribers) {
    const email = s.email.trim().toLowerCase();
    if (email) seen.add(email);
  }
  return seen.size;
}

/**
 * What share of accounts said yes.
 *
 * Null under a handful of accounts, following the same rule the rest of
 * Insights uses: a percentage off three people will be believed and means
 * nothing.
 */
export const MIN_FOR_RATE = 5;

export function optInRate(subscribed: number, accounts: number): number | null {
  if (accounts < MIN_FOR_RATE) return null;
  return Math.round((subscribed / accounts) * 100);
}

export interface SendSummary {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Sends by outcome.
 *
 * Skipped is not a failure and is counted apart from one. It means consent said
 * no, or a nudge was suppressed as too soon, which are the system working
 * rather than the system breaking.
 */
export function summarise(rows: SendRow[]): SendSummary {
  const summary: SendSummary = { sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    if (row.status === "SENT") summary.sent += 1;
    else if (row.status === "FAILED") summary.failed += 1;
    else summary.skipped += 1;
  }
  return summary;
}

/**
 * The failures, newest first.
 *
 * Surfaced separately because a bounced password reset is somebody locked out
 * of their account, and it is invisible in a list where nine in ten rows say
 * SENT.
 */
export function failures(rows: SendRow[], take = 10): SendRow[] {
  return rows
    .filter((row) => row.status === "FAILED")
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, take);
}

/**
 * Somebody with an account, which is everybody.
 *
 * Deliberately a different type from Subscriber, with no source and no opt-in
 * date, so the two lists cannot be passed to each other's functions. The whole
 * risk in showing every account's address on the same page as the mailing list
 * is that one gets used as the other, and a type is a cheaper guard than
 * remembering.
 */
export interface Account {
  email: string;
  since: Date;
  /** Whether they also said yes to product news. */
  subscribed: boolean;
}

/**
 * How many accounts said yes, counted off the accounts themselves.
 *
 * Reads the flag on the list in front of you rather than a separate count, so
 * the number under the list always agrees with the list.
 */
export function subscribedCount(accounts: Account[]): number {
  return accounts.filter((a) => a.subscribed).length;
}

/**
 * Accounts, newest first.
 *
 * There is no addressList equivalent for these on purpose. Copying every
 * address to a clipboard is one paste away from a send nobody consented to,
 * and the reason to look at this list is to see who is using Freely, which
 * reading does perfectly well.
 */
export function recentAccounts(accounts: Account[], take = 200): Account[] {
  return accounts
    .slice()
    .sort((a, b) => b.since.getTime() - a.since.getTime())
    .slice(0, take);
}

/** How a source reads on screen, since the stored value is an identifier. */
export function sourceLabel(source: string | null): string {
  if (!source) return "Unknown";
  return source.replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase());
}
