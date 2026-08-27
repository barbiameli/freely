import { formatMoney } from "@/lib/money";
import type { Locale } from "@/lib/i18n";
/** One billable chunk, as it is stored on the quote's settings. */
export interface QuoteMilestone {
  name: string;
  deliverableIndexes: number[];
  /** The agreement that closes it, which is why the split falls here. */
  gate?: string;
  amount: number;
}

/**
 * Reads the milestones off a quote's stored settings.
 *
 * They live inside the settings JSON rather than in a column, so every reader
 * needs the same cast and the same guard: milestones only count when the quote
 * is actually billed that way, since a leftover array from a plan somebody
 * changed their mind about would put a schedule on a quote that has none.
 */
export function milestonesFromSettings(settings: unknown): QuoteMilestone[] {
  const parsed = (settings as { useMilestones?: boolean; milestones?: QuoteMilestone[] } | null) ?? {};
  if (!parsed.useMilestones) return [];
  return Array.isArray(parsed.milestones) ? parsed.milestones : [];
}

/** A milestone and the deliverables it pays for, ready to render. */
export interface MilestoneGroup {
  name: string;
  /** Formatted with its currency symbol. Empty for the catch-all group. */
  amount: string;
  /** "Invoiced on completion", or nothing when the freelancer wrote terms. */
  note?: string;
  /** Indexes into the quote's deliverables, in the order they should read. */
  items: number[];
}

/**
 * The deliverables, grouped under the milestone that pays for them.
 *
 * One implementation, used by the published page and by the PDF. They are the
 * same document in two files: a client who reads one and prints the other must
 * not find two different agreements, and the surest way to end up with two was
 * to write the grouping twice, which is what this replaced.
 *
 * Returns null when the quote is not grouped, which the callers read as "render
 * the flat list you have always rendered". Every index is checked against the
 * deliverables, so a milestone pointing at a deliverable that was deleted, or
 * at the same one twice, cannot duplicate or drop a line. Anything left over
 * gets its own group at the end, because a deliverable no milestone claims is
 * still work the client is paying for.
 */
export function groupDeliverables(input: {
  milestones?: QuoteMilestone[];
  deliverables: string[];
  currency?: string | null;
  language: Locale;
  grouped: boolean;
  /** Their own payment terms, which outrank the default note. */
  paymentTerms?: string;
  words: { invoicedAtEnd: string; alsoIncluded: string };
}): MilestoneGroup[] | null {
  const milestones = input.milestones ?? [];
  if (!input.grouped || milestones.length === 0) return null;

  const covered = new Set<number>();
  const groups: MilestoneGroup[] = [];

  for (const milestone of milestones) {
    const items: number[] = [];
    for (const index of milestone.deliverableIndexes) {
      if (!Number.isInteger(index)) continue;
      if (!input.deliverables[index] || covered.has(index)) continue;
      covered.add(index);
      items.push(index);
    }
    groups.push({
      name: milestone.name,
      amount: formatMoney(milestone.amount, input.currency, input.language),
      note: input.paymentTerms ? undefined : input.words.invoicedAtEnd,
      items,
    });
  }

  const leftovers = input.deliverables
    .map((_, index) => index)
    .filter((index) => !covered.has(index));
  if (leftovers.length > 0) {
    groups.push({ name: input.words.alsoIncluded, amount: "", items: leftovers });
  }

  return groups;
}
