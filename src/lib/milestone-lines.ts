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
