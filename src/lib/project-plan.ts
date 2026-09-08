/**
 * A first plan, from the shape of the project rather than from nothing.
 *
 * The board and the timeline both started empty, so the first thing anybody
 * saw on a project was a blank grid and a pile of unplaced pills. Editing is
 * easy and starting is not, so this lays down something defensible and leaves
 * the freelancer to argue with it.
 *
 * Four facts make the plan: when it runs, how many hours a day, which days are
 * working days, and which deliverables deserve more of the time. All four are
 * asked once, in one panel, and all four are editable afterwards.
 *
 * The window is fixed. A starred deliverable takes days from the others rather
 * than making the project longer, because the end date was agreed with a
 * client and the only real question is where the time goes inside it.
 */

export interface PlannableTask {
  id: string;
  deliverableId: string;
  estimateHours: number;
  order: number;
  done: boolean;
}

export interface PlannableDeliverable {
  id: string;
  order: number;
  /** 1 normally, 2 when starred. */
  priority: number;
}

export interface Shape {
  /** Days of the week that count as working days. 0 is Sunday. */
  workingDays: number[];
  hoursPerDay: number;
}

export const DEFAULT_SHAPE: Shape = { workingDays: [1, 2, 3, 4, 5], hoursPerDay: 6 };

function atMidnight(value: Date | string): Date {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Every working day in the window, in order.
 *
 * The window rather than a count, because "ten working days from the 14th"
 * and "the working days between the 14th and the 28th" are different
 * questions and only the second one respects the date somebody agreed.
 */
export function workingDaysIn(
  start: Date | string,
  end: Date | string,
  workingDays: number[]
): Date[] {
  const days: Date[] = [];
  const last = atMidnight(end);
  const cursor = atMidnight(start);
  // A guard rather than a while(true): a bad date pair should produce a short
  // plan, not a page that never finishes loading.
  for (let i = 0; i < 3650 && cursor.getTime() <= last.getTime(); i += 1) {
    if (workingDays.includes(cursor.getUTCDay())) days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * How many days each deliverable gets.
 *
 * Weighted by the work in it and by whether it was starred, then handed out
 * largest-remainder so the parts add up to the whole. Every deliverable with
 * unfinished work gets at least one day: a deliverable allocated nothing is a
 * deliverable that silently left the plan, which is the failure this whole
 * view exists to prevent.
 */
export function shareOutDays(
  deliverables: PlannableDeliverable[],
  tasks: PlannableTask[],
  totalDays: number
): Map<string, number> {
  const live = deliverables.filter((deliverable) =>
    tasks.some((task) => task.deliverableId === deliverable.id && !task.done)
  );
  const out = new Map<string, number>();
  if (live.length === 0 || totalDays <= 0) return out;

  const weightOf = (deliverable: PlannableDeliverable) => {
    const hours = tasks
      .filter((task) => task.deliverableId === deliverable.id && !task.done)
      .reduce((sum, task) => sum + Math.max(task.estimateHours, 0.5), 0);
    return Math.max(hours, 0.5) * Math.max(deliverable.priority, 1);
  };

  const weights = live.map((deliverable) => ({ id: deliverable.id, weight: weightOf(deliverable) }));
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);

  /*
   * Weighted across the whole window first, and only then floored at one day.
   *
   * Handing out one day each up front and sharing the rest was the obvious
   * way round and it flattened the star: with six deliverables in ten days
   * there were four days left to weight, so a starred deliverable and an
   * ordinary one both came out at two. The star has to act on the whole
   * allocation to mean anything.
   */
  const shares = weights.map((entry) => {
    const exact = (entry.weight / total) * totalDays;
    return { id: entry.id, weight: entry.weight, whole: Math.floor(exact), rest: exact - Math.floor(exact) };
  });

  for (const share of shares) out.set(share.id, share.whole);
  let left = totalDays - shares.reduce((sum, share) => sum + share.whole, 0);

  // Largest remainder, and a heavier deliverable wins a tie: everything here
  // rounds down, so without this the days add up to less than the window.
  const byRemainder = shares
    .slice()
    .sort((a, b) => (b.rest - a.rest !== 0 ? b.rest - a.rest : b.weight - a.weight));
  for (const share of byRemainder) {
    if (left <= 0) break;
    out.set(share.id, (out.get(share.id) ?? 0) + 1);
    left -= 1;
  }

  /*
   * Nothing is allowed to end up with no days.
   *
   * A deliverable allocated zero has silently left the plan, which is the
   * failure this whole view exists to prevent. The day comes off whichever
   * has the most, so the window still adds up. When there are more
   * deliverables than days there is nothing honest to do, and everything gets
   * one: the plan then overruns visibly, which is the correct answer.
   */
  for (const share of shares) {
    if ((out.get(share.id) ?? 0) > 0) continue;
    const richest = Array.from(out.entries())
      .filter(([, days]) => days > 1)
      .sort((a, b) => b[1] - a[1])[0];
    if (richest) out.set(richest[0], richest[1] - 1);
    out.set(share.id, 1);
  }

  return out;
}

/** Where one task sits inside its deliverable's run of days. */
export interface TaskSpan {
  id: string;
  /** Index into the deliverable's slice of days. */
  from: number;
  to: number;
}

/**
 * How the days of one deliverable are divided between its tasks.
 *
 * By estimate, not by counting. Cutting the slice into equal pieces gave a
 * six-hour task and a one-hour task identical bars, so the chart said nothing
 * about where the work actually was: everything looked like a day, and a
 * fortnight of thirty-one identical pills is a list drawn on a calendar.
 *
 * Every task keeps at least one day, and where the estimates ask for more
 * days than the deliverable was given, the tasks are scaled down together and
 * end up sharing days. Sharing is the honest answer: it is what actually
 * happens on a Tuesday, and the alternative is a bar chart that has quietly
 * moved the end date.
 */
export function spreadTasks(
  tasks: PlannableTask[],
  slotCount: number,
  hoursPerDay: number
): TaskSpan[] {
  if (tasks.length === 0 || slotCount <= 0) return [];

  const perDay = Math.max(hoursPerDay, 0.5);
  const wanted = tasks.map((task) => Math.max(1, Math.ceil(task.estimateHours / perDay)));
  const total = wanted.reduce((sum, days) => sum + days, 0);

  // Scaled to fit when the estimates ask for more than there is, and left
  // alone when they fit: a deliverable given more days than its work needs
  // should not have its bars stretched to fill the space, because that is a
  // claim about how long the work takes.
  const scale = total > slotCount ? slotCount / total : 1;

  const out: TaskSpan[] = [];
  let cursor = 0;
  for (let i = 0; i < tasks.length; i += 1) {
    const span = Math.max(1, Math.round(wanted[i] * scale));
    const from = Math.min(cursor, slotCount - 1);
    const to = Math.min(from + span - 1, slotCount - 1);
    out.push({ id: tasks[i].id, from, to });
    cursor = to + 1;
    // Out of room: everything left shares the last day rather than falling
    // off the end of the deliverable and into the next one's time.
    if (cursor >= slotCount) cursor = slotCount - 1;
  }
  return out;
}

export interface FirstPlacement {
  id: string;
  start: Date;
  end: Date;
}

/**
 * The whole first plan: which day each task starts and ends on.
 *
 * Deliverables in their agreed order, tasks in theirs, each deliverable
 * spread across the days it was given. Where a deliverable has more tasks
 * than days, tasks share a day rather than pushing the next deliverable
 * later: the alternative is a plan that quietly runs past the end date it was
 * built from.
 */
export function firstPlan(
  deliverables: PlannableDeliverable[],
  tasks: PlannableTask[],
  start: Date | string,
  end: Date | string,
  shape: Shape = DEFAULT_SHAPE
): FirstPlacement[] {
  const days = workingDaysIn(start, end, shape.workingDays);
  if (days.length === 0) return [];

  const allocation = shareOutDays(deliverables, tasks, days.length);
  const ordered = deliverables
    .slice()
    .sort((a, b) => a.order - b.order)
    .filter((deliverable) => allocation.has(deliverable.id));

  const out: FirstPlacement[] = [];
  let dayIndex = 0;

  for (const deliverable of ordered) {
    const span = allocation.get(deliverable.id) ?? 1;
    const slice = days.slice(dayIndex, dayIndex + span);
    if (slice.length === 0) break;
    dayIndex += span;

    const live = tasks
      .filter((task) => task.deliverableId === deliverable.id && !task.done)
      .sort((a, b) => a.order - b.order);
    if (live.length === 0) continue;

    for (const span of spreadTasks(live, slice.length, shape.hoursPerDay)) {
      out.push({
        id: span.id,
        start: slice[span.from],
        end: slice[Math.min(span.to, slice.length - 1)],
      });
    }
  }

  return out;
}

/**
 * Whether the window can hold the work at all, at this many hours a day.
 *
 * Reported rather than corrected. Squeezing the bars to fit is the one thing
 * this view exists to prevent, so the honest answer is the number of days
 * short and a decision for the freelancer.
 */
export function daysShort(
  tasks: PlannableTask[],
  start: Date | string,
  end: Date | string,
  shape: Shape = DEFAULT_SHAPE
): number {
  const available = workingDaysIn(start, end, shape.workingDays).length;
  const hours = tasks
    .filter((task) => !task.done)
    .reduce((sum, task) => sum + Math.max(task.estimateHours, 0), 0);
  const needed = Math.ceil(hours / Math.max(shape.hoursPerDay, 0.5));
  return Math.max(0, needed - available);
}

export interface Squeeze {
  deliverableId: string;
  /** Working days it was given. */
  has: number;
  /** Working days its estimates ask for. */
  needs: number;
}

/**
 * Which deliverables were given less time than their work asks for.
 *
 * The plan always fits the window, because the window is the thing that was
 * agreed and a chart running past it helps nobody. Fitting is therefore not
 * the question: the question is what got squeezed to make it fit, and that is
 * a decision somebody has to be told about rather than one made quietly on
 * their behalf.
 *
 * Starred deliverables are squeezed last, which is the entire point of the
 * star: it is a way of saying which corners may be cut.
 */
export function squeezed(
  deliverables: PlannableDeliverable[],
  tasks: PlannableTask[],
  allocation: Map<string, number>,
  hoursPerDay: number
): Squeeze[] {
  const out: Squeeze[] = [];
  for (const deliverable of deliverables) {
    const has = allocation.get(deliverable.id);
    if (has === undefined) continue;
    const hours = tasks
      .filter((task) => task.deliverableId === deliverable.id && !task.done)
      .reduce((sum, task) => sum + Math.max(task.estimateHours, 0), 0);
    const needs = Math.max(1, Math.ceil(hours / Math.max(hoursPerDay, 0.5)));
    if (needs > has) out.push({ deliverableId: deliverable.id, has, needs });
  }
  // Worst first: that is the one worth talking to the client about.
  return out.sort((a, b) => b.needs - b.has - (a.needs - a.has));
}
