/**
 * What the history means for the next quote, said in a sentence.
 *
 * Deliberately built from the figures rather than from a model reading the
 * quotes. Everything here is checkable against the numbers printed directly
 * above it, which is the only reason advice like this is worth reading: a
 * paragraph about how a client "prefers a collaborative approach" is a guess
 * wearing the clothes of a fact.
 *
 * So the rules are few and each one is tied to a figure. Where nothing is
 * known it says nothing, which is better than filling the space.
 */
import type { ClientHistory } from "@/lib/clients";

export type ReadKey =
  | "new"
  | "reliable"
  | "slow"
  | "overdue"
  | "decisive"
  | "quiet"
  | "losing";

/**
 * The notes worth making about this client, most useful first.
 *
 * More than three is a wall nobody reads, and the fourth is always the
 * weakest, so the caller takes the top of this list.
 */
export function readHistory(history: ClientHistory): ReadKey[] {
  const out: ReadKey[] = [];
  if (history.quotes === 0) return ["new"];

  // Money first: it is the thing that goes wrong most expensively.
  if (history.overdueInvoices > 0) out.push("overdue");
  else if ((history.typicalPaymentDays ?? 0) > 3) out.push("slow");
  else if (history.typicalPaymentDays !== null && history.typicalPaymentDays <= 0) {
    out.push("reliable");
  }

  // Then how they decide, which is what a quote's shape should answer to.
  if (history.typicalAnswerDays !== null && history.typicalAnswerDays <= 3) out.push("decisive");
  else if ((history.typicalAnswerDays ?? 0) > 10) out.push("quiet");

  // Then whether the work is actually coming, which is worth knowing before
  // spending an afternoon on the next one.
  if (history.quotes >= 3 && history.won === 0) out.push("losing");

  return out.slice(0, 3);
}
