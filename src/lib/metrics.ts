import type { EventKind } from "@/lib/events";

/**
 * Turning a list of events into the handful of numbers worth looking at.
 *
 * Pure, so the arithmetic can be tested. Every metric here has been got wrong
 * by somebody in a dashboard somewhere, usually in the same three ways: dividing
 * by the wrong denominator, counting rows where distinct people were meant, and
 * showing a percentage of four things as though it meant something.
 *
 * The one rule running through it: a number nobody can act on is worse than no
 * number, because it still gets read and reasoned about. So a rate over a tiny
 * sample comes back null rather than 100%, and the dashboard says so.
 */

export interface EventRow {
  kind: string;
  userId: string | null;
  subjectId: string | null;
  createdAt: Date;
}

/** Below this, a percentage is noise dressed as a finding. */
export const MIN_SAMPLE = 5;

export interface Funnel {
  generated: number;
  published: number;
  accepted: number;
  tracked: number;
  invoiced: number;
}

/**
 * The core loop, counted in distinct quotes rather than events.
 *
 * Counting rows would let one quote published three times look like three
 * quotes, and the whole point of the funnel is that each step is a subset of
 * the one before it.
 */
export function funnel(events: EventRow[]): Funnel {
  return {
    generated: distinct(events, "quote_generated"),
    published: distinct(events, "quote_published"),
    accepted: distinct(events, "quote_accepted"),
    tracked: distinct(events, "project_tracked"),
    invoiced: distinct(events, "invoice_created"),
  };
}

/**
 * How many different quotes reached one step.
 *
 * A module-level function taking the rows as an argument, which looks like the
 * more verbose way to write it, and is not optional.
 *
 * This was a local arrow closing over `events`. When the production build
 * inlined `funnel` into the Insights page, the first call had `events` renamed
 * to the caller's variable and the other four kept the literal name, which by
 * then referred to nothing. The page died with "events is not defined" while
 * every test passed, because the bug did not exist until the minifier made it.
 *
 * Nothing here may close over a parameter of the function it is called from.
 * Pass the rows in. Verified by tests/metrics-closure.test.ts.
 */
function distinct(events: EventRow[], kind: EventKind): number {
  const seen = new Set<string>();
  for (const event of events) {
    if (event.kind === kind && event.subjectId) seen.add(event.subjectId);
  }
  return seen.size;
}

/**
 * A step's conversion, or null when there is not enough to divide by.
 *
 * "100% of quotes were accepted" off two quotes is a sentence that makes people
 * change their pricing, and it means nothing.
 */
export function rate(part: number, whole: number, minimum = MIN_SAMPLE): number | null {
  if (whole < minimum) return null;
  return Math.round((part / whole) * 100);
}

/** People who did something in the window, not visits. */
export function activeUsers(events: EventRow[]): number {
  return new Set(events.filter((e) => e.userId).map((e) => e.userId)).size;
}

export interface Retention {
  /** Signed up in the window. */
  joined: number;
  /** Of those, how many did anything at all afterwards. */
  activated: number;
  /** Of those, how many generated more than one quote. */
  returned: number;
}

/**
 * Whether new accounts do anything.
 *
 * Three numbers rather than a percentage, because the interesting failure is
 * usually the gap between two of them, and a single number hides which gap.
 *
 * "Activated" means one real action, not a sign-in: somebody who logged in,
 * looked around and left has not used the product, and counting them as
 * activated is how a team convinces itself onboarding works.
 */
export function retention(events: EventRow[], since: Date): Retention {
  const signups = events.filter((e) => e.kind === "signed_up" && e.createdAt >= since);
  const joined = new Set(signups.map((e) => e.userId).filter(Boolean));

  const didSomething = new Map<string, number>();
  for (const event of events) {
    if (!event.userId || event.kind === "signed_up") continue;
    if (!joined.has(event.userId)) continue;
    if (event.kind !== "quote_generated") {
      didSomething.set(event.userId, didSomething.get(event.userId) ?? 0);
      continue;
    }
    didSomething.set(event.userId, (didSomething.get(event.userId) ?? 0) + 1);
  }

  return {
    joined: joined.size,
    activated: didSomething.size,
    returned: Array.from(didSomething.values()).filter((count) => count > 1).length,
  };
}

export interface DayCount {
  /** yyyy-mm-dd. */
  day: string;
  count: number;
}

/**
 * A count per day, with the empty days present.
 *
 * Missing days are the classic way a chart lies: skip them and a quiet week
 * renders as a straight line between two peaks, which reads as steady use.
 */
export function perDay(events: EventRow[], kind: EventKind, days: number, now = new Date()): DayCount[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.kind !== kind) continue;
    const day = event.createdAt.toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 3600_000).toISOString().slice(0, 10);
    out.push({ day, count: counts.get(day) ?? 0 });
  }
  return out;
}

/** The busiest kinds, for spotting what people actually use. */
export function byKind(events: EventRow[]): { kind: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);
}
