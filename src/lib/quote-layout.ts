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
export const CURRENT_LAYOUT = 3;

/**
 * Version 1: deliverables as one flat list, no milestone schedule on the
 * client's page at all. Every quote written before August 2026.
 *
 * Version 2: when a quote is billed per milestone, the deliverables are
 * grouped under the milestone that pays for them, with the amount on the
 * milestone. Otherwise identical to version 1.
 *
 * Version 3: milestones get a section of their own, and the deliverables go
 * back to being a plain list. Version 2 folded the two together, so a quote
 * with stages showed no milestones anywhere: they appeared as headings inside
 * the deliverables and read as deliverables, which is what a client called
 * them. They are different things. A deliverable is something the client ends
 * up holding; a milestone is a stage of the work, which may or may not be a
 * point where money moves.
 */
export type LayoutVersion = 1 | 2 | 3;

export function layoutOf(settings: unknown): LayoutVersion {
  const stored = (settings as { layout?: unknown } | null)?.layout;
  if (stored === 3) return 3;
  return stored === 2 ? 2 : 1;
}

/**
 * Whether this quote shows its deliverables grouped under milestones.
 *
 * Version 2 only. Newer quotes give the milestones a section instead, and
 * older ones never had them at all. Both conditions, always: the quote has to
 * have been written for the layout, and it has to actually have milestones. A
 * quote with a leftover array from a plan somebody changed their mind about
 * renders as a plain list.
 */
export function groupsByMilestone(settings: unknown, milestoneCount: number): boolean {
  return layoutOf(settings) === 2 && milestoneCount > 0;
}

/** Whether this quote shows milestones as a section of their own. */
export function showsMilestoneSection(settings: unknown, milestoneCount: number): boolean {
  return layoutOf(settings) >= 3 && milestoneCount > 0;
}

/**
 * Whether the milestones are where money moves, or only the shape of the work.
 *
 * These were the same thing, and they are not. Plenty of projects run in
 * stages that are useful to name and agreed to be paid for in two lumps at
 * either end, and putting an amount on every stage of one of those invents a
 * payment schedule nobody agreed to. So an amount appears only when the
 * freelancer said this is how they are billing.
 *
 * Defaults to true for quotes written before the distinction existed, since
 * those were all created under a payment plan that meant billing.
 */
export function milestonesAreBillable(settings: unknown): boolean {
  const parsed = (settings as { milestonesBillable?: unknown; layout?: unknown } | null) ?? {};
  if (layoutOf(settings) < 3) return true;
  return parsed.milestonesBillable !== false;
}
