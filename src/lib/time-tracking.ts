/**
 * Where the hours went, and what that is allowed to mean.
 *
 * Freely quotes in hours and never learned what the hours were. A freelancer
 * who runs a third over on every design system job has no way to see it,
 * prices the next one the same way, and absorbs the difference again. And the
 * "estimate, billed by the hour" option tells a client they pay for hours
 * actually worked, which the app could not know.
 *
 * What the tracking is *for* is deliberately a choice, and it is made per
 * engagement rather than once for the account. The same person tracks a
 * fixed-price job to find out what it really cost and an hourly one because
 * the client is paying for the hours, and a single account-wide switch would
 * force one answer onto both. The same tool is a discipline to one person, a private
 * record of where the week went to another, and the thing that fills an
 * invoice to a third, and only the last of those wants Freely putting hours in
 * front of a client. Each mode includes the one before it, so turning it up is
 * always additive and nothing disappears.
 */

export type TimeMode = "OFF" | "RECORD" | "LEARN" | "BILLING";

export const TIME_MODES: TimeMode[] = ["OFF", "RECORD", "LEARN", "BILLING"];

export function parseTimeMode(value: unknown): TimeMode {
  return typeof value === "string" && (TIME_MODES as string[]).includes(value)
    ? (value as TimeMode)
    : "OFF";
}

const RANK: Record<TimeMode, number> = { OFF: 0, RECORD: 1, LEARN: 2, BILLING: 3 };

/** Whether the account keeps a record of hours at all. */
export function tracksTime(mode: TimeMode): boolean {
  return RANK[mode] >= RANK.RECORD;
}

/** Whether past accuracy is allowed to shape a new quote's hours. */
export function learnsFromTime(mode: TimeMode): boolean {
  return RANK[mode] >= RANK.LEARN;
}

/** Whether hours may reach a client, on an invoice or a quote. */
export function billsFromTime(mode: TimeMode): boolean {
  return RANK[mode] >= RANK.BILLING;
}

/** One stretch of work, as the sums need it. */
export interface Entry {
  minutes: number;
  billable: boolean;
  projectId?: string | null;
  startedAt: string;
}

/** How long a stretch was, in whole minutes, never negative. */
export function minutesBetween(from: Date | string, to: Date | string): number {
  const start = typeof from === "string" ? Date.parse(from) : from.getTime();
  const end = typeof to === "string" ? Date.parse(to) : to.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

/** Minutes as the app says them: "3h 20m", "45m", "0m". */
export function sayHours(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/** Hours, rounded the way an invoice line wants them. */
export function toHours(minutes: number, step = 0.25): number {
  if (minutes <= 0) return 0;
  const hours = minutes / 60;
  return Math.round(hours / step) * step;
}

export interface TimeTotals {
  /** Everything, billable or not. */
  minutes: number;
  /** Only what may be charged for. */
  billableMinutes: number;
  entries: number;
}

export function totals(entries: Entry[]): TimeTotals {
  return {
    minutes: entries.reduce((sum, e) => sum + e.minutes, 0),
    billableMinutes: entries.filter((e) => e.billable).reduce((sum, e) => sum + e.minutes, 0),
    entries: entries.length,
  };
}

/**
 * How the estimate held up.
 *
 * The number worth knowing is not "did it go over" but "by how much, and does
 * it always". One project over by a fifth is a project; four in a row over by
 * a fifth is a pricing habit, and it is the only thing here that can change
 * what somebody charges.
 */
export interface Accuracy {
  /** What was quoted, in hours. */
  quoted: number;
  /** What it took, in hours. */
  actual: number;
  /** actual / quoted. Above 1 means it ran over. */
  ratio: number;
  /** Whole percent over or under. Negative means it came in under. */
  percent: number;
}

export function accuracyOf(quotedHours: number, actualMinutes: number): Accuracy | null {
  // A project with no estimate cannot be over or under one.
  if (quotedHours <= 0 || actualMinutes <= 0) return null;
  const actual = actualMinutes / 60;
  const ratio = actual / quotedHours;
  return {
    quoted: quotedHours,
    actual: Math.round(actual * 10) / 10,
    ratio,
    percent: Math.round((ratio - 1) * 100),
  };
}

/** Enough finished projects that a pattern is a pattern. */
const MIN_PROJECTS = 3;

/**
 * The habit across several projects, where there is one.
 *
 * Returns nothing below three, and nothing when the overrun is small enough to
 * be ordinary. Telling somebody they run 4% over is noise dressed as insight,
 * and it would make the useful version easier to ignore.
 */
export function estimateHabit(
  projects: { quotedHours: number; actualMinutes: number }[]
): { median: number; percent: number; projects: number } | null {
  const ratios = projects
    .map((p) => accuracyOf(p.quotedHours, p.actualMinutes)?.ratio)
    .filter((r): r is number => typeof r === "number");

  if (ratios.length < MIN_PROJECTS) return null;

  const sorted = [...ratios].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];

  const percent = Math.round((median - 1) * 100);
  if (Math.abs(percent) < 10) return null;

  return { median, percent, projects: ratios.length };
}

/**
 * What to tell the model when it is estimating hours.
 *
 * Only at LEARN and above, and only as a correction to apply rather than a
 * number to copy: the model still estimates the job in front of it, and this
 * says which direction this person's estimates habitually miss in.
 */
export function habitInstruction(
  habit: ReturnType<typeof estimateHabit>,
  mode: TimeMode
): string {
  if (!habit || !learnsFromTime(mode)) return "";
  const direction = habit.percent > 0 ? "longer than" : "less time than";
  return `\nThis freelancer's tracked time says their projects take about ${Math.abs(
    habit.percent
  )}% ${direction} they estimate, across ${habit.projects} finished projects. Estimate the hours this job honestly needs, then adjust in that direction. Do not mention tracked time, past projects or this correction anywhere in the quote.`;
}

/**
 * Whether a running project has reached the point its quote promised to flag.
 *
 * An hourly quote says the freelancer will say something at 80% of the
 * estimate and stop at it without a written go-ahead. That is a promise the
 * app can only keep if it is watching.
 */
export function thresholdReached(
  quotedHours: number,
  actualMinutes: number,
  at = 0.8
): boolean {
  if (quotedHours <= 0) return false;
  return actualMinutes / 60 >= quotedHours * at;
}

/**
 * The mode for one engagement.
 *
 * The project's own answer, or the account's default when it has one and the
 * freelancer has said not to ask again. Null means nobody has decided, which
 * is what puts a "set up the tracker" button on the project rather than a
 * timer nobody asked for.
 */
export function modeForProject(
  project: { timeTracking?: unknown },
  account: { timeTracking?: unknown; timeTrackingAsk?: unknown }
): TimeMode | null {
  if (typeof project.timeTracking === "string") return parseTimeMode(project.timeTracking);
  // Asking again is the default until somebody says otherwise: the first time
  // they answer, they have no way of knowing whether the answer generalises.
  if (account.timeTrackingAsk !== false) return null;
  const fallback = parseTimeMode(account.timeTracking);
  return fallback === "OFF" ? null : fallback;
}
