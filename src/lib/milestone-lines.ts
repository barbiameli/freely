import { formatMoney } from "@/lib/money";
import type { Locale } from "@/lib/i18n";
/**
 * Whether this quote's stages are where money moves.
 *
 * Read from the settings rather than inferred, and defaulting to false, so a
 * quote paid in one sum never has a clause written about invoicing a stage.
 * Inferring it from the payment plan was how "the next milestone starts"
 * reached a quote that had no payment milestones.
 */
export function milestonesBillableFromSettings(settings: unknown): boolean {
  const parsed = (settings as { milestonesBillable?: unknown } | null) ?? {};
  return parsed.milestonesBillable === true;
}

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

/** One milestone, ready to render as its own line. */
export interface MilestoneLine {
  name: string;
  /** What closes it, when there is one. */
  gate: string;
  /** What lands in it, named from the deliverables it covers. */
  delivers: string[];
  /** Formatted with its symbol. Empty when the milestones are not billable. */
  amount: string;
}

/**
 * The milestones, as a section of their own.
 *
 * They used to render only as headings inside the deliverables list, which is
 * why a client reading a real quote saw no milestones anywhere and took the
 * headings for deliverables. They are different things: a deliverable is
 * something the client ends up holding, a milestone is a stage of the work.
 *
 * The amount is the part that has to be chosen rather than assumed. A project
 * can run in stages and still be paid in two lumps at either end, and putting
 * a figure on every stage of one of those invents a schedule nobody agreed to.
 */
export function milestoneLines({
  milestones,
  deliverables,
  currency,
  language,
  billable,
}: {
  milestones: QuoteMilestone[] | undefined;
  deliverables: string[];
  currency?: string | null;
  language?: Locale;
  billable: boolean;
}): MilestoneLine[] {
  if (!milestones?.length) return [];

  return milestones.map((milestone) => ({
    name: milestone.name,
    gate: milestone.gate ?? "",
    delivers: (milestone.deliverableIndexes ?? [])
      .map((index) => deliverables[index])
      .filter(Boolean)
      // The short form: a client reading the stages wants to know what lands
      // in each, not to read the deliverables list twice.
      .map((text) => text.split(/\s+[-–—]\s+/)[0].trim()),
    amount: billable && milestone.amount > 0 ? formatMoney(milestone.amount, currency, language) : "",
  }));
}
