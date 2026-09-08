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
  /*
   * Deadlines deliberately do not change the placement.
   *
   * One freelancer working through a queue cannot be rescheduled by a date:
   * the tasks take what they take and they happen in order, so a deliverable
   * due on the 16th whose work needs until the 22nd still needs until the
   * 22nd. Passing the deadlines in here and quietly compressing the bars
   * would draw a plan that fits and is not true, which is the one thing this
   * view exists to prevent.
   *
   * So the dates are checked against the plan rather than used to build it.
   * See fitPerDeliverable and whatToDoAbout.
   */
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

/** What a deliverable's own deadline says about the plan laid against it. */
export interface DeliverableFit {
  deliverableId: string;
  /** Working days past its own due date. Zero when it fits. */
  over: number;
  /** Working days the tasks need. */
  needs: number;
  /** Working days there actually are. */
  has: number;
}

/**
 * Whether each deliverable's work fits before the date it was promised.
 *
 * Per deliverable rather than for the project as a whole, because a project
 * that finishes on time with the first deliverable a week late is a project
 * whose client has already been let down once. This is the number worth
 * seeing before the work starts rather than during it.
 */
export function fitPerDeliverable(
  tasks: PlannedTask[],
  placements: Placement[],
  start: Date | string,
  deadlines: Map<string, Date | string>
): DeliverableFit[] {
  const placed = new Map(placements.map((p) => [p.id, p] as const));
  const byDeliverable = new Map<string, PlannedTask[]>();
  for (const task of tasks) {
    if (task.done) continue;
    const list = byDeliverable.get(task.deliverableId) ?? [];
    list.push(task);
    byDeliverable.set(task.deliverableId, list);
  }

  const out: DeliverableFit[] = [];
  for (const [deliverableId, list] of Array.from(byDeliverable.entries())) {
    const due = deadlines.get(deliverableId);
    if (!due) continue;
    const ends = list
      .map((task) => placed.get(task.id)?.end)
      .filter((value): value is Date => Boolean(value));
    if (ends.length === 0) continue;
    const last = ends.reduce((latest, end) => (end > latest ? end : latest), ends[0]);
    const over = businessDaysBetween(due, last);
    out.push({
      deliverableId,
      over: over > 0 ? over : 0,
      needs: list.reduce((sum, task) => sum + daysNeeded(task.estimateHours), 0),
      has: Math.max(0, businessDaysBetween(start, due)),
    });
  }
  return out;
}

/**
 * What to do about work that does not fit.
 *
 * Not "you are over by six days", which somebody can already see. The useful
 * answer is what to change, and there are only three honest ones: move the
 * date, cut the scope, or agree now that what lands is rougher than what was
 * described. The last is the one freelancers reach for silently in week two,
 * and saying it out loud in week one is the difference between a proof of
 * concept and a disappointment.
 */
export function whatToDoAbout(fits: DeliverableFit[]): "fits" | "trim" | "roughen" {
  const worst = fits.reduce((most, fit) => Math.max(most, fit.over), 0);
  if (worst === 0) return "fits";
  const needed = fits.reduce((sum, fit) => sum + fit.needs, 0);
  const available = fits.reduce((sum, fit) => sum + fit.has, 0);
  // A quarter over is a scope conversation. Half again over is not something
  // trimming a task fixes, and pretending otherwise is how the fortnight
  // disappears.
  return available > 0 && needed > available * 1.25 ? "roughen" : "trim";
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

/**
 * Bars packed into as few rows as possible.
 *
 * A row per task is honest and unreadable: thirty tasks across a fortnight
 * drew a thirty-row staircase, mostly empty, where the eye had to travel a
 * screen and a half to see two weeks of work.
 *
 * Greedy first-fit by start date. Two tasks that do not overlap share a row,
 * which is what a Gantt chart is actually for: the vertical axis carries no
 * meaning of its own, so spending a row on each bar wastes the only dimension
 * that was free.
 *
 * Sorted by start first, so the packing is stable: the same plan lays out the
 * same way twice, and a bar does not jump rows because another one moved.
 */
export function packLanes(bars: Bar[]): Bar[][] {
  const sorted = bars.slice().sort((a, b) => a.offset - b.offset || a.days - b.days);
  const lanes: Bar[][] = [];
  const ends: number[] = [];

  for (const bar of sorted) {
    let lane = ends.findIndex((end) => end <= bar.offset);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push([]);
      ends.push(0);
    }
    lanes[lane].push(bar);
    ends[lane] = bar.offset + bar.days;
  }

  return lanes;
}
