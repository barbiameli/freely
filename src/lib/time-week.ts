import { secondsOf } from "@/lib/time-tracking";

/**
 * A week of tracked time, laid out the way a calendar is.
 *
 * A list of entries is a receipt. A week is a shape: it shows the day nothing
 * got done, the afternoon that swallowed six hours, and the fact that a
 * project everyone thought was finished is still taking Thursdays. None of
 * that is visible in a column of durations.
 *
 * Deliberately days rather than a full hour grid. An hour grid is a calendar,
 * and Google already is one; the useful thing here is how much and on what,
 * which fits in a column per day.
 */

export interface WeekEntry {
  id: string;
  startedAt: string;
  minutes: number;
  seconds?: number;
  note: string;
  billable: boolean;
  deliverableId?: string | null;
}

export interface DayColumn {
  /** Midnight at the start of the day, in ISO. */
  date: string;
  /** Monday first, so the week reads the way a working week does. */
  weekday: number;
  seconds: number;
  entries: WeekEntry[];
  isToday: boolean;
}

/** Midnight, local to the server's own clock, which is what dates are keyed on. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The Monday of the week containing this date.
 *
 * Monday rather than Sunday because the thing being looked at is a working
 * week, and a layout that puts Saturday in the middle of it reads wrong to
 * everyone who is not American.
 */
export function weekStart(date: Date): Date {
  const day = startOfDay(date);
  // getDay is 0 on Sunday, so Sunday is six days after the Monday, not one
  // before it.
  const back = (day.getDay() + 6) % 7;
  return new Date(day.getTime() - back * 86_400_000);
}

/**
 * Seven days, in order, each with the entries that started in it.
 *
 * Keyed on when work started rather than when it ended: a session that runs
 * past midnight belongs to the evening somebody was working, which is how they
 * will look for it.
 */
export function weekOf(entries: WeekEntry[], start: Date, today = new Date()): DayColumn[] {
  const from = weekStart(start);
  const todayKey = startOfDay(today).getTime();

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(from.getTime() + index * 86_400_000);
    const dayStart = date.getTime();
    const dayEnd = dayStart + 86_400_000;

    const mine = entries.filter((entry) => {
      const at = Date.parse(entry.startedAt);
      return Number.isFinite(at) && at >= dayStart && at < dayEnd;
    });

    return {
      date: date.toISOString(),
      weekday: index,
      seconds: mine.reduce((sum, entry) => sum + secondsOf(entry), 0),
      entries: mine.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)),
      isToday: dayStart === todayKey,
    };
  });
}

/** The tallest day in the week, for scaling the bars against something real. */
export function busiestSeconds(days: DayColumn[]): number {
  return days.reduce((most, day) => Math.max(most, day.seconds), 0);
}

/** Everything in the week. */
export function weekSeconds(days: DayColumn[]): number {
  return days.reduce((sum, day) => sum + day.seconds, 0);
}
