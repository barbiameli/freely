/**
 * The line under the timeline count.
 *
 * A tracker is a list of things you have not done yet, which is a slightly
 * demoralising object to open every morning. One dry sentence about where you
 * actually are costs nothing and changes how the card reads.
 *
 * Three rules, and they are what keep this from becoming the thing people turn
 * off.
 *
 * It is earned. Every message corresponds to something true and specific:
 * three ticked today, ahead of the calendar, one left, finished early. Nothing
 * congratulates you for opening the page, and there is no message at all for
 * the ordinary middle of a project, which is most days.
 *
 * It is deterministic. The message is chosen from the state, not at random, so
 * it does not change on every render or reward a refresh. Within a state it
 * varies by the numbers, so it shifts as the work moves rather than shuffling.
 *
 * And it does not scold. Behind is a real state and it gets a real line, but it
 * points at the next move rather than at the failure. Nobody needs a tracker to
 * tell them off.
 */

export interface CheerInput {
  /** Deliverables with a date, done or not. */
  total: number;
  done: number;
  /** Due and not ticked. */
  overdue: number;
  /** Ticked today, from the doneAt stamps. */
  doneToday: number;
  /** How far through the schedule today is, 0 to 1. Null when unscheduled. */
  elapsed: number | null;
  /** Whole days between today and the due date. Negative once it has passed. */
  daysToDue: number | null;
}

/**
 * Which line to show, or null for nothing.
 *
 * Keys into the dictionary rather than the text, so the copy is translated with
 * everything else and lives where a translator can find it.
 */
export type CheerKey =
  | "cheerAllDoneEarly"
  | "cheerAllDone"
  | "cheerBurstMany"
  | "cheerBurstFew"
  | "cheerLastOne"
  | "cheerBehindMany"
  | "cheerBehindOne"
  | "cheerAhead"
  | "cheerHalfway"
  | "cheerFirstDone"
  | "cheerNotStarted";

export interface Cheer {
  key: CheerKey;
  /** Filled into the message, where it takes one. */
  count?: number;
  /** Whether this reads as good news, which decides its colour. */
  good: boolean;
}

/** Being this far ahead of the calendar is worth remarking on. Less than this
 * is noise: a project is always a little ahead or behind. */
const AHEAD_MARGIN = 0.15;

/** Ticking this many in a day is a real day's work rather than a tidy-up. */
const BURST_MANY = 3;

export function cheerFor(input: CheerInput): Cheer | null {
  const { total, done, overdue, doneToday, elapsed, daysToDue } = input;
  if (total === 0) return null;

  // Order matters, and it is an order of what somebody would rather hear. A day
  // where three things got ticked is worth saying even on a project that is
  // behind, because it is the more useful fact about today.
  if (done === total) {
    return daysToDue !== null && daysToDue > 0
      ? { key: "cheerAllDoneEarly", count: daysToDue, good: true }
      : { key: "cheerAllDone", good: true };
  }

  if (doneToday >= BURST_MANY) {
    return { key: "cheerBurstMany", count: doneToday, good: true };
  }

  if (total - done === 1) return { key: "cheerLastOne", good: true };

  if (doneToday >= 2) return { key: "cheerBurstFew", count: doneToday, good: true };

  // Behind outranks ahead, obviously, and outranks the milder good-news lines:
  // telling somebody they are halfway while two things are past their date is
  // reading the wrong number out.
  if (overdue > 1) return { key: "cheerBehindMany", count: overdue, good: false };
  if (overdue === 1) return { key: "cheerBehindOne", good: false };

  if (elapsed !== null && done / total - elapsed >= AHEAD_MARGIN) {
    return { key: "cheerAhead", good: true };
  }

  // Halfway only on the way past it, and only on a project long enough for a
  // halfway to mean anything. "1 of 2 done" does not need announcing.
  if (total >= 4 && done * 2 >= total && (done - 1) * 2 < total) {
    return { key: "cheerHalfway", good: true };
  }

  if (done === 1 && doneToday === 1) return { key: "cheerFirstDone", good: true };

  if (done === 0 && (elapsed === null || elapsed < 0.5)) {
    return { key: "cheerNotStarted", good: false };
  }

  // The ordinary middle of a project. Nothing to say, and saying something
  // anyway is how this feature would come to be ignored.
  return null;
}
