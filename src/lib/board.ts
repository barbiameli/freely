/**
 * Which column a task sits in, and what moving it means.
 *
 * Three columns out of the state a Step already carries, plus one nullable
 * date. `done` stays the only answer to "is this finished", because two fields
 * that can both claim a task is complete is how a card ends up in one column
 * on the board and a different one in the progress bar. `startedAt` only
 * matters while `done` is false.
 *
 * Pure, so the rules can be tested without a database and without rendering:
 * dragging a card is the one interaction in the app where being wrong is
 * immediately obvious and hard to undo.
 */

export type Column = "TODO" | "DOING" | "DONE";

export const COLUMNS: Column[] = ["TODO", "DOING", "DONE"];

export interface BoardStep {
  id: string;
  name: string;
  done: boolean;
  startedAt: string | null;
  order: number;
  estimateHours: number;
  /** Which deliverable it belongs to, shown as a tag on the card. */
  deliverableId: string;
}

export function columnOf(step: Pick<BoardStep, "done" | "startedAt">): Column {
  if (step.done) return "DONE";
  return step.startedAt ? "DOING" : "TODO";
}

/**
 * What moving a card to a column changes about the task itself.
 *
 * Returned rather than applied, so the action writes exactly this and the
 * tests can check it without a database.
 *
 * Moving out of Done unticks it, which is the whole point of dragging it back.
 * Moving to To do clears the start, because a task you have not begun should
 * not claim a start time; that loses "when did I first pick this up", and the
 * alternative is a card sitting in To do insisting it started on Tuesday.
 */
export function changesFor(target: Column, now = new Date()): {
  done: boolean;
  startedAt: Date | null;
  doneAt: Date | null;
} {
  if (target === "DONE") return { done: true, startedAt: null, doneAt: now };
  if (target === "DOING") return { done: false, startedAt: now, doneAt: null };
  return { done: false, startedAt: null, doneAt: null };
}

/**
 * Keeps the start time when a card is only being reordered inside Doing.
 *
 * changesFor would stamp a new one, so a task you began on Monday and nudged
 * up the column on Wednesday would claim it started on Wednesday.
 */
export function changesForMove(
  from: Column,
  to: Column,
  existingStartedAt: Date | null,
  now = new Date()
): { done: boolean; startedAt: Date | null; doneAt: Date | null } {
  const next = changesFor(to, now);
  if (from === "DOING" && to === "DOING" && existingStartedAt) {
    return { ...next, startedAt: existingStartedAt };
  }
  return next;
}

/**
 * The ids of one column, in order, after a card lands in it at `index`.
 *
 * Order is stored per step and is only meaningful within a column, so this
 * returns the whole column rather than one number: writing a single order
 * value leaves ties, and ties on a board look like cards swapping places at
 * random when the page reloads.
 */
export function reorder(columnIds: string[], movedId: string, index: number): string[] {
  const without = columnIds.filter((id) => id !== movedId);
  const at = Math.max(0, Math.min(index, without.length));
  return [...without.slice(0, at), movedId, ...without.slice(at)];
}

/** The steps of one column, in the order they should be drawn. */
export function columnSteps(steps: BoardStep[], column: Column): BoardStep[] {
  return steps
    .filter((step) => columnOf(step) === column)
    .sort((a, b) => a.order - b.order);
}

/**
 * How far through, weighted by estimate.
 *
 * Counting cards makes a ten minute task worth the same as a two day one, so
 * a board can read as half finished while all the work is still to come.
 * Falls back to counting when nothing is estimated.
 */
export function boardProgress(steps: BoardStep[]): { done: number; total: number } {
  const estimated = steps.some((step) => step.estimateHours > 0);
  const weight = (step: BoardStep) => (estimated ? step.estimateHours : 1);
  const total = steps.reduce((sum, step) => sum + weight(step), 0);
  const done = steps.filter((step) => step.done).reduce((sum, step) => sum + weight(step), 0);
  return { done, total };
}
