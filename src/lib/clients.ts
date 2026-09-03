import type { ProtectionLevel } from "@/lib/protection";

/**
 * Who you are working for, joined up across quotes, projects and invoices.
 *
 * Matched on the name that is already typed into every quote rather than
 * maintained by hand. Asking somebody to keep a client list up to date is
 * asking for admin, and admin is the first thing to be abandoned; a list
 * nobody fills in is a feature nobody has.
 */

/**
 * The name, reduced to something two spellings of it can agree on.
 *
 * "Beyond Data", "beyond data" and "Beyond Data Ltd." are one client. The
 * legal suffixes go, punctuation goes, spacing collapses. Deliberately not
 * cleverer than that: fuzzy matching would eventually merge two real clients
 * with similar names, and that is a worse mistake than missing a match, since
 * the person can see a duplicate and cannot see a bad merge.
 */
const SUFFIXES = [
  "ltd",
  "limited",
  "llc",
  "inc",
  "incorporated",
  "gmbh",
  "bv",
  "sl",
  "sa",
  "srl",
  "plc",
  "co",
  "company",
  "studio",
  "agency",
];

export function clientSlug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize("NFD")
    // Accents off, so "Sánchez" and "Sanchez" are one person.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // Only from the end, and never all of it: a client actually called "Studio"
  // should keep its name.
  while (cleaned.length > 1 && SUFFIXES.includes(cleaned[cleaned.length - 1])) {
    cleaned.pop();
  }
  return cleaned.join(" ");
}

/** Whether a name is worth making a record for. */
export function isRealName(name: string): boolean {
  const slug = clientSlug(name);
  if (slug.length < 2) return false;
  // The stand-ins the model writes when a brief names nobody. Making records
  // for these would collect every anonymous quote under one imaginary client.
  return !["client", "a client", "the client", "cliente", "el cliente", "unknown", "n a"].includes(
    slug
  );
}

/** What has happened with this client, from their own rows. */
export interface ClientHistory {
  quotes: number;
  won: number;
  lost: number;
  /** Days from sending to an answer, across the ones that were answered. */
  typicalAnswerDays: number | null;
  /** Days past the due date, across paid invoices. Negative means early. */
  typicalPaymentDays: number | null;
  /** Invoices still unpaid past their due date. */
  overdueInvoices: number;
}

export const NO_HISTORY: ClientHistory = {
  quotes: 0,
  won: 0,
  lost: 0,
  typicalAnswerDays: null,
  typicalPaymentDays: null,
  overdueInvoices: 0,
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

const DAY = 86_400_000;

export function historyFrom(
  quotes: { outcome: string; createdAt: Date; acceptedAt: Date | null }[],
  invoices: { dueAt: Date; paidAt: Date | null }[],
  now = Date.now()
): ClientHistory {
  const answerDays = quotes
    .filter((q) => q.acceptedAt)
    .map((q) => Math.round((q.acceptedAt!.getTime() - q.createdAt.getTime()) / DAY))
    .filter((d) => d >= 0);

  const paymentDays = invoices
    .filter((i) => i.paidAt)
    .map((i) => Math.round((i.paidAt!.getTime() - i.dueAt.getTime()) / DAY));

  return {
    quotes: quotes.length,
    won: quotes.filter((q) => q.outcome === "WON").length,
    lost: quotes.filter((q) => q.outcome === "LOST").length,
    typicalAnswerDays: median(answerDays),
    typicalPaymentDays: median(paymentDays),
    overdueInvoices: invoices.filter((i) => !i.paidAt && i.dueAt.getTime() < now).length,
  };
}

/**
 * What the history says about how much armour this quote needs.
 *
 * This is the question that could not be answered before clients had an
 * identity, and it is the one a freelancer actually asks: have I worked with
 * these people, and did they behave.
 *
 * A good record earns a lighter quote. A bad one is not a reason to be rude,
 * it is a reason to write the terms down, so it returns GUARDED rather than
 * anything that shows on the client's page. Nothing here reaches the client.
 */
export function levelFromHistory(history: ClientHistory): {
  level: ProtectionLevel;
  reason: "new" | "paidLate" | "overdue" | "good" | "unproven";
} | null {
  if (history.quotes === 0) return { level: "NEW", reason: "new" };

  // Money already owed past its date, from this same client.
  if (history.overdueInvoices > 0) return { level: "GUARDED", reason: "overdue" };

  // A pattern of paying well after the terms they agreed to.
  if (history.typicalPaymentDays !== null && history.typicalPaymentDays > 14) {
    return { level: "GUARDED", reason: "paidLate" };
  }

  // Won work, paid near enough on time, more than once.
  if (
    history.won >= 1 &&
    (history.typicalPaymentDays === null || history.typicalPaymentDays <= 7)
  ) {
    return { level: "KNOWN", reason: "good" };
  }

  // Quoted before, never landed. Not a warning, just not a relationship yet.
  return { level: "NEW", reason: "unproven" };
}
