/**
 * What a client sees, worked out from the tracker.
 *
 * The page used to show whatever the freelancer had written and sent. That made
 * it only as current as the last time somebody remembered to write an update,
 * which on a busy project is never, and a page that says nothing since the 4th
 * is worse than no page at all.
 *
 * So the two lists here are derived. What has just been finished, and what is
 * coming next, both read straight off the work as it is ticked. The page is
 * right the moment a box is ticked and nobody has to write anything.
 *
 * Three of each, deliberately. A client opening this wants to know whether
 * things are moving and what happens next, and a complete audit trail answers
 * neither. Anything longer belongs in the deliverable list above it, which is
 * there in full.
 */

export const SHOWN = 3;

export interface ClientStep {
  id: string;
  name: string;
  done: boolean;
  order: number;
}

export interface ClientDeliverable {
  id: string;
  name: string;
  done: boolean;
  doneAt: Date | null;
  dueAt: Date | null;
  order: number;
  steps: ClientStep[];
}

/** One line on the page, from a step where there are steps, or a deliverable. */
export interface ClientLine {
  id: string;
  /** The step or deliverable itself. */
  text: string;
  /** The deliverable it sits under, when the line is a step. */
  under: string | null;
  at: Date | null;
}

/**
 * The last few things finished, newest first.
 *
 * Steps where a deliverable has them, because "Exported the type scale" tells a
 * client more about momentum than "Design system" does, and a deliverable that
 * has been broken down is one where the interesting progress is inside it.
 *
 * A deliverable with no steps contributes itself, so a freelancer who never
 * breaks anything down still gets a page that fills in.
 *
 * Steps carry no completion time of their own, so they inherit the
 * deliverable's. Within one deliverable that leaves them tied, and the tie is
 * broken by their order, which is the sequence the work was planned in.
 */
export function recentlyDone(deliverables: ClientDeliverable[], take = SHOWN): ClientLine[] {
  const lines: ClientLine[] = [];

  for (const d of deliverables) {
    const doneSteps = d.steps.filter((s) => s.done);

    if (doneSteps.length > 0) {
      for (const s of doneSteps) {
        lines.push({ id: s.id, text: s.name, under: d.name, at: d.doneAt });
      }
      continue;
    }

    if (d.done) lines.push({ id: d.id, text: d.name, under: null, at: d.doneAt });
  }

  // Newest first. Lines are collected in planned order, so reversing before
  // the sort makes the later-planned one win a tie, which is the best guess
  // available when several steps share a deliverable's completion time.
  return lines
    .reverse()
    .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
    .slice(0, take);
}

/**
 * The next few things to be done, in the order they are planned.
 *
 * The same rule in reverse: the unfinished steps of a deliverable already under
 * way, then whole deliverables that have not been started. Dates are not used
 * to order this, because plenty of projects have none and the planned sequence
 * is the more reliable answer.
 */
export function comingUp(deliverables: ClientDeliverable[], take = SHOWN): ClientLine[] {
  const lines: ClientLine[] = [];

  for (const d of deliverables) {
    if (d.done) continue;

    const todo = d.steps.filter((s) => !s.done);
    if (todo.length > 0) {
      for (const s of todo) lines.push({ id: s.id, text: s.name, under: d.name, at: d.dueAt });
      continue;
    }

    lines.push({ id: d.id, text: d.name, under: null, at: d.dueAt });
  }

  return lines.slice(0, take);
}

/** Whether a deliverable has a list worth opening. */
export function hasDetail(d: ClientDeliverable): boolean {
  return d.steps.length > 0;
}

/** How far along, as a percentage, counting steps where they exist. */
export function progress(deliverables: ClientDeliverable[]): {
  done: number;
  total: number;
  percent: number;
} {
  const done = deliverables.filter((d) => d.done).length;
  const total = deliverables.length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
