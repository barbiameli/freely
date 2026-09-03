/**
 * Counting in business days, because that is what the clauses say.
 *
 * Every window a quote states is in business days: feedback within three,
 * accepted after ten. Counting calendar days instead would make a stage
 * delivered on a Thursday overdue two days earlier than one delivered on a
 * Monday, which is not what anybody agreed to and is exactly the sort of
 * quiet unfairness a client notices.
 *
 * Weekends only. Public holidays vary by country and by client, and a
 * calendar that is wrong about somebody's national holiday is worse than one
 * that does not pretend to know: being a day out in the freelancer's favour
 * is how a nudge becomes an argument.
 */

const DAY = 86_400_000;

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Whole business days from one moment to another.
 *
 * The starting day does not count: work delivered on Monday has had nought
 * business days by Monday evening and one by Tuesday. That is how somebody
 * reads "within three business days" when they are the one waiting.
 */
export function businessDaysBetween(from: Date | string, to: Date | string): number {
  const start = typeof from === "string" ? new Date(from) : from;
  const end = typeof to === "string" ? new Date(to) : to;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end <= start) return 0;

  let count = 0;
  // Walk from the day after the start, at midnight, so partial days at either
  // end cannot make the answer depend on the hour something was ticked off.
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  );
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

  while (cursor.getTime() < last.getTime()) {
    cursor.setTime(cursor.getTime() + DAY);
    if (!isWeekend(cursor)) count += 1;
  }
  return count;
}

/** The date N business days after a moment, for saying when something falls due. */
export function addBusinessDays(from: Date | string, days: number): Date {
  const start = typeof from === "string" ? new Date(from) : from;
  const cursor = new Date(start.getTime());
  let left = Math.max(0, Math.round(days));
  while (left > 0) {
    cursor.setTime(cursor.getTime() + DAY);
    if (!isWeekend(cursor)) left -= 1;
  }
  return cursor;
}
