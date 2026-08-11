/**
 * Milestones: chunks of work that get billed, each grouping deliverables.
 *
 * The app used to treat one deliverable as one milestone. That is wrong in the
 * common case and wrong in a way that costs money: a six-deliverable project
 * agreed as three milestones was invoicing in six pieces of a sixth each, so
 * every invoice was the wrong amount on the wrong day.
 *
 * A milestone is decided when the quote is written, because that is when the
 * client agrees to it. Everything here is about reading that decision, never
 * about inventing one.
 */

/** A milestone as the model returns it, before it has any database identity. */
export interface GeneratedMilestone {
  name: string;
  /**
   * What closes this milestone beyond its deliverables.
   *
   * Usually an agreement rather than an artifact: a direction signed off, a
   * decision made, access granted. This is what makes a milestone a milestone
   * rather than a batch, because it is the thing the next chunk of work cannot
   * start without, and it is usually the client's move rather than the
   * freelancer's.
   */
  gate?: string;
  /**
   * Which deliverables it covers, by their position in the deliverables list.
   *
   * Indices rather than names: the model reliably repeats a name back with a
   * word changed, and a near-match is worse than an index, which either points
   * at something or does not.
   */
  deliverableIndexes: number[];
  /** Its share of the total price. */
  amount: number;
}

export interface MilestoneView {
  id: string;
  name: string;
  order: number;
  amount: number;
  /** What closes it beyond the deliverables, when there is such a thing. */
  gate?: string | null;
  invoicedAt?: Date | string | null;
}

export interface DeliverableInMilestone {
  id: string;
  milestoneId?: string | null;
  done: boolean;
}

/**
 * Repairs a generated split so it covers the work exactly once.
 *
 * The model is asked for a partition and usually gives one, but "usually" is
 * not something to bill against. Three things can go wrong, and all three are
 * silent: a deliverable in two milestones bills twice, a deliverable in none
 * never bills at all, and shares that do not sum to the price mean the client
 * is charged the wrong total.
 *
 * So: duplicates are dropped after their first appearance, anything left over
 * joins the last milestone, and the last milestone absorbs the rounding
 * remainder. Deterministic, and it always produces something billable.
 */
export function reconcileMilestones(
  milestones: GeneratedMilestone[],
  deliverableCount: number,
  totalPrice: number
): GeneratedMilestone[] {
  if (milestones.length === 0 || deliverableCount === 0) return [];

  const seen = new Set<number>();
  const cleaned = milestones.map((m) => {
    const indexes = m.deliverableIndexes.filter((i) => {
      if (!Number.isInteger(i) || i < 0 || i >= deliverableCount) return false;
      if (seen.has(i)) return false;
      seen.add(i);
      return true;
    });
    return { ...m, deliverableIndexes: indexes };
  });

  // Anything the model forgot goes on the end, so no work is unbillable.
  const missing: number[] = [];
  for (let i = 0; i < deliverableCount; i++) if (!seen.has(i)) missing.push(i);
  if (missing.length) {
    cleaned[cleaned.length - 1] = {
      ...cleaned[cleaned.length - 1],
      deliverableIndexes: [...cleaned[cleaned.length - 1].deliverableIndexes, ...missing],
    };
  }

  // A milestone covering nothing is not a milestone.
  const withWork = cleaned.filter((m) => m.deliverableIndexes.length > 0);
  if (withWork.length === 0) return [];

  return balanceAmounts(withWork, totalPrice);
}

/**
 * Makes the shares add up to the price exactly.
 *
 * Keeps the model's proportions where it gave usable ones, since it was
 * reasoning about the relative size of the work. Falls back to splitting by
 * how many deliverables each covers, which is a poor proxy but an honest one.
 *
 * The last share takes the remainder. Three milestones on a £100 project
 * invoicing £33.33 each and quietly losing a penny is the kind of thing a
 * client notices and nobody can explain.
 */
export function balanceAmounts(
  milestones: GeneratedMilestone[],
  totalPrice: number
): GeneratedMilestone[] {
  const stated = milestones.reduce((sum, m) => sum + (m.amount > 0 ? m.amount : 0), 0);
  const totalDeliverables = milestones.reduce((sum, m) => sum + m.deliverableIndexes.length, 0);

  let allocated = 0;
  return milestones.map((m, i) => {
    if (i === milestones.length - 1) {
      return { ...m, amount: round2(totalPrice - allocated) };
    }
    const fraction =
      stated > 0
        ? (m.amount > 0 ? m.amount : 0) / stated
        : m.deliverableIndexes.length / totalDeliverables;
    const amount = round2(totalPrice * fraction);
    allocated = round2(allocated + amount);
    return { ...m, amount };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface MilestoneProgress {
  /** Which milestone the work is on, 1-based. Equals total once all are done. */
  current: number;
  total: number;
}

/**
 * Which milestone a project is on.
 *
 * A milestone is finished when every deliverable in it is. "Milestone 2 of 3"
 * means one is complete and the second is in hand, which is what someone wants
 * to know mid-project. It reads 3 of 3 at the end rather than 4 of 3.
 */
export function milestoneProgress(
  milestones: MilestoneView[],
  deliverables: DeliverableInMilestone[]
): MilestoneProgress {
  const total = milestones.length;
  if (total === 0) return { current: 0, total: 0 };

  const done = milestones.filter((m) => isMilestoneDone(m.id, deliverables)).length;
  return { current: Math.min(done + 1, total), total };
}

/**
 * Whether every deliverable in a milestone is finished.
 *
 * A milestone with no deliverables is not done. It cannot be: there is nothing
 * in it to finish, and treating an empty group as complete would let it be
 * invoiced for work that was never described.
 */
export function isMilestoneDone(
  milestoneId: string,
  deliverables: DeliverableInMilestone[]
): boolean {
  const inIt = deliverables.filter((d) => d.milestoneId === milestoneId);
  return inIt.length > 0 && inIt.every((d) => d.done);
}

/** Milestones that are finished and not yet billed, in order. */
export function billableMilestones(
  milestones: MilestoneView[],
  deliverables: DeliverableInMilestone[]
): MilestoneView[] {
  return milestones
    .filter((m) => !m.invoicedAt && isMilestoneDone(m.id, deliverables))
    .sort((a, b) => a.order - b.order);
}
