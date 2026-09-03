import { businessDaysBetween } from "@/lib/business-days";

/**
 * Watching the clauses actually run.
 *
 * A quote can now say that delivered work with no response after ten business
 * days counts as accepted and is invoiced, and that feedback is due within
 * three. Until this existed, nothing watched for either happening: the
 * sentences were on the document and the freelancer was still sitting inside a
 * live project, unpaid, with no mechanism to charge for it or release their
 * time. That is the exact shape of the worst project in the notes this feature
 * came from.
 *
 * Deliberately not a judgement about the client. Silence is what the clause
 * already said it was, so this is arithmetic on dates the freelancer entered:
 * you delivered it then, the window you agreed has passed, here is the invoice
 * button.
 *
 * Nothing here acts on its own. It surfaces the moment and the freelancer
 * presses it, because invoicing somebody automatically on a clause they have
 * possibly forgotten agreeing to is a way to lose a client rather than a way
 * to get paid.
 */

/** A stage of a project, as this needs it. */
export interface WatchedStage {
  id: string;
  projectId: string;
  projectTitle: string;
  client: string;
  name: string;
  amount: number;
  currency: string | null;
  /** When it was billed, if it has been. */
  invoicedAt: string | null;
  /** Every deliverable in it, with when it was finished. */
  deliverables: { done: boolean; doneAt: string | null }[];
}

export type WatchKind = "deemedAccepted" | "feedbackOverdue" | "waiting";

export interface StageWatch {
  kind: WatchKind;
  stage: WatchedStage;
  /** When the last piece of it landed. */
  deliveredAt: string;
  /** Business days since then. */
  businessDays: number;
}

/**
 * When a stage was finished: the last of its deliverables to be ticked.
 *
 * Nothing while any of them is outstanding, because a stage is not delivered
 * until all of it is, and starting a clock on a half-finished stage would
 * eventually invoice for work nobody has sent.
 */
export function deliveredAt(stage: WatchedStage): string | null {
  if (stage.deliverables.length === 0) return null;
  if (stage.deliverables.some((d) => !d.done)) return null;

  const times = stage.deliverables
    .map((d) => (d.doneAt ? Date.parse(d.doneAt) : NaN))
    .filter((t) => !Number.isNaN(t));
  // Ticked before doneAt was recorded. Real, on older projects, and not
  // something to guess a date for.
  if (times.length !== stage.deliverables.length) return null;

  return new Date(Math.max(...times)).toISOString();
}

/**
 * What each stage is waiting on, and for how long.
 *
 * Only stages that are finished and not yet billed. Anything already invoiced
 * is settled, whatever the client said or did not say.
 */
export function watchStages(
  stages: WatchedStage[],
  windows: { acceptanceDays: number; feedbackDays: number },
  now: Date = new Date()
): StageWatch[] {
  const found: StageWatch[] = [];

  for (const stage of stages) {
    if (stage.invoicedAt) continue;
    const delivered = deliveredAt(stage);
    if (!delivered) continue;

    const days = businessDaysBetween(delivered, now);
    const kind: WatchKind =
      days >= windows.acceptanceDays
        ? "deemedAccepted"
        : days > windows.feedbackDays
        ? "feedbackOverdue"
        : "waiting";

    found.push({ kind, stage, deliveredAt: delivered, businessDays: days });
  }

  // The ones with money attached first, then the ones eating the schedule,
  // then the ones that are simply in progress.
  const order: Record<WatchKind, number> = { deemedAccepted: 0, feedbackOverdue: 1, waiting: 2 };
  return found.sort(
    (a, b) => order[a.kind] - order[b.kind] || b.businessDays - a.businessDays
  );
}

/** The ones worth putting in front of somebody. */
export function needsAction(watches: StageWatch[]): StageWatch[] {
  return watches.filter((w) => w.kind !== "waiting");
}
