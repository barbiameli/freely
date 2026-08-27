/**
 * Which layout a quote was written for.
 *
 * A published quote lives at a URL a client has been sent. They may read it
 * today, forward it to a colleague, and open it again in three weeks to check
 * what they agreed to. Rendering it from current code means any change to the
 * layout silently rewrites a document somebody has already signed off, and the
 * client has no way to know it moved. That is not a redesign, it is a contract
 * changing itself.
 *
 * So the layout is pinned when the quote is written and read back from the
 * quote, not from the code. Everything generated before this existed has no
 * number and is version 1: exactly the page it has always been. New quotes get
 * the current version and can look however the current version looks.
 *
 * The cost is that the renderer keeps old branches around. That is the correct
 * cost. Deleting one is a decision to change documents already in somebody
 * else's hands, and it should feel like one.
 */

/** What a quote written today gets. */
export const CURRENT_LAYOUT = 2;

/**
 * Version 1: deliverables as one flat list, no milestone schedule on the
 * client's page at all. Every quote written before August 2026.
 *
 * Version 2: when a quote is billed per milestone, the deliverables are
 * grouped under the milestone that pays for them, with the amount on the
 * milestone. Otherwise identical to version 1.
 */
export type LayoutVersion = 1 | 2;

export function layoutOf(settings: unknown): LayoutVersion {
  const stored = (settings as { layout?: unknown } | null)?.layout;
  return stored === 2 ? 2 : 1;
}

/**
 * Whether this quote shows its deliverables grouped under milestones.
 *
 * Both conditions, always: the quote has to have been written for the layout,
 * and it has to actually be billed that way. A quote with a leftover milestone
 * array from a plan somebody changed their mind about renders as a plain list.
 */
export function groupsByMilestone(settings: unknown, milestoneCount: number): boolean {
  return layoutOf(settings) >= 2 && milestoneCount > 0;
}
