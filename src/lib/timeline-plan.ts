/**
 * Where each task sits on the calendar, and how to work that out for somebody.
 *
 * The board answers "what am I doing now". This answers "will it fit", which
 * is the question a freelancer actually gets wrong: two weeks of work agreed
 * into a ten day window, discovered in week two.
 *
 * All of it is arithmetic rather than a model call. Placing blocks on a
 * calendar is division, and a scheduler that is instant, free and gives the
 * same answer twice is worth more here than one that reasons: the freelancer
 * is going to drag half of them anyway, and a plan that shifts under them
 * between two presses of the same button is not a plan.
 */
import { addBusinessDays, businessDaysBetween } from "@/lib/business-days";

/** Hours in a working day, for turning estimates into calendar space. */
export const HOURS_PER_DAY = 6;

export interface PlannedTask {
  id: string;
  name: string;
  deliverableId: string;
  estimateHours: number;
  order: number;
  done: boolean;
  plannedStart: string | null;
  plannedEnd: string | null;
}

/** A bar on the chart, in day offsets from the start of the span. */
export interface Bar {
  id: string;
  /** Days from the span's start. Zero is the first column. */
  offset: number;
  /** How many days wide. Never less than one, or the bar is invisible. */
  days: number;
}

/**
 * The start of that calendar day, in UTC.
 *
 * UTC on purpose. These are dates, not instants: "this task is on the 8th" is
 * true in Valencia and in Los Angeles. Stored as timestamps and read with
 * local getters, a task saved as midnight on the 8th reads as the 7th for
 * anybody west of Greenwich, so the same plan draws a column to the left
 * depending on where it is opened. Every read and write here goes through
 * this, so the chart, the scheduler and the database agree on what a day is.
 */
function atMidnight(value: Date | string): Date {
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
}

/** A date-only string, which is what a calendar day actually is. */
export function dayKey(value: Date | string): string {
  return atMidnight(value).toISOString().slice(0, 10);
}

/** Whole days between two dates, ignoring the clock. */
export function daysBetween(from: Date | string, to: Date | string): number {
  return Math.round((atMidnight(to).getTime() - atMidnight(from).getTime()) / 86_400_000);
}

/**
 * The columns the chart draws, one per day.
 *
 * Days rather than weeks, because a two-week project is the common case here
 * and a chart with two columns tells nobody anything. Long projects get a
 * scroll rather than a coarser unit: a month-wide column cannot show that
 * something takes a day and a half.
 */
export function dayColumns(start: Date | string, end: Date | string): Date[] {
  const total = Math.max(0, daysBetween(start, end));
  const first = atMidnight(start);
  return Array.from({ length: total + 1 }, (_, i) => {
    const day = new Date(first);
    day.setUTCDate(day.getUTCDate() + i);
    return day;
  });
}

/** Where a placed task's bar goes, or null when it has not been placed. */
export function barFor(task: PlannedTask, spanStart: Date | string): Bar | null {
  if (!task.plannedStart || !task.plannedEnd) return null;
  const offset = daysBetween(spanStart, task.plannedStart);
  const days = Math.max(1, daysBetween(task.plannedStart, task.plannedEnd) + 1);
  return { id: task.id, offset, days };
}

/**
 * How many working days a task needs.
 *
 * Rounded up, because half a day of work still occupies a day you cannot give
 * to something else, and an unestimated task gets one rather than zero: a bar
 * with no width is a task that has silently left the plan.
 */
export function daysNeeded(hours: number): number {
  if (!(hours > 0)) return 1;
  return Math.max(1, Math.ceil(hours / HOURS_PER_DAY));
}

export interface Placement {
  id: string;
  start: Date;
  end: Date;
}

/**
 * A plan for the whole project, laid end to end from the start date.
 *
 * In board order within each deliverable, and deliverables in their own
 * order, because that is the sequence somebody actually agreed. Nothing runs
 * in parallel: one freelancer cannot do two things at once, and a chart that
 * pretends otherwise is how a fortnight of work fits into a week on paper.
 *
 * Finished tasks are skipped rather than scheduled into the past.
 *
 * It deliberately does not stop at the due date. Overrunning is the answer
 * when the work does not fit, and hiding that by squeezing every bar is the
 * one thing this view exists to prevent. `overrunDays` says by how much.
 */
export function autoSchedule(
  tasks: PlannedTask[],
  start: Date | string,
  deliverableOrder: string[] = []
): Placement[] {
  const rank = new Map(deliverableOrder.map((id, i) => [id, i] as const));
  const queue = tasks
    .filter((task) => !task.done)
    .slice()
    .sort((a, b) => {
      const byDeliverable =
        (rank.get(a.deliverableId) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.deliverableId) ?? Number.MAX_SAFE_INTEGER);
      return byDeliverable !== 0 ? byDeliverable : a.order - b.order;
    });

  const out: Placement[] = [];
  let cursor = atMidnight(start);

  for (const task of queue) {
    const span = daysNeeded(task.estimateHours);
    const first = nextWorkingDay(cursor);
    // Minus one, because a one-day task starts and ends on the same day.
    const last = addBusinessDays(first, span - 1);
    out.push({ id: task.id, start: first, end: last });
    cursor = addBusinessDays(last, 1);
  }

  return out;
}

/** The same day when it is a weekday, the next Monday when it is not. */
function nextWorkingDay(from: Date): Date {
  const day = atMidnight(from);
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) {
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return day;
}

/**
 * How far past the due date the plan runs, in working days.
 *
 * Zero when it fits. Positive is the number that matters: it is the
 * conversation to have with the client now rather than in week two.
 */
export function overrunDays(placements: Placement[], due: Date | string | null): number {
  if (!due || placements.length === 0) return 0;
  const last = placements.reduce(
    (latest, p) => (p.end.getTime() > latest.getTime() ? p.end : latest),
    placements[0].end
  );
  const over = businessDaysBetween(due, last);
  return over > 0 ? over : 0;
}
