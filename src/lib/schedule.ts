import { parseTimelineStages } from "@/lib/timeline";

/**
 * Turning a quote's timeline into real dates.
 *
 * A quote says "Week 1-2: Discovery". That is only a date once someone
 * decides when day one is, which is what a project start date is for. These
 * functions do that mapping and nothing else: the results are written to the
 * database once, as ordinary editable dates, so a freelancer who slips a week
 * can just change the date rather than fight a derived value.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole days from a to b, ignoring the time of day, so "due today" is 0
 * rather than a fraction either side of zero depending on the hour. */
export function daysBetween(a: Date, b: Date): number {
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}

/**
 * The last week a stage label refers to.
 *
 * "Week 1-2" ends in week 2, "Week 3" ends in week 3. Anything that doesn't
 * name a week returns null, and the caller spaces those evenly instead, since
 * a made-up date is worse than an even split.
 */
export function stageEndWeek(period: string): number | null {
  const weeks = period.match(/\d+/g);
  if (!weeks?.length) return null;
  return Math.max(...weeks.map(Number));
}

export interface ScheduledStage {
  label: string;
  detail: string;
  /** End of the stage, which is what a deadline actually is. */
  dueAt: Date;
}

/**
 * Maps timeline stages onto dates from a start date.
 *
 * Stages that name weeks are placed at the end of their last week. Stages
 * that don't are spread evenly across whatever span the named ones imply, or
 * a week each if none of them name anything.
 */
export function scheduleStages(timeline: string, startDate: Date): ScheduledStage[] {
  const stages = parseTimelineStages(timeline);
  if (stages.length === 0) return [];

  const weeks = stages.map((s) => stageEndWeek(s.period));
  const namedWeeks = weeks.filter((w): w is number => w !== null);
  const lastWeek = namedWeeks.length ? Math.max(...namedWeeks) : stages.length;

  return stages.map((stage, i) => {
    const named = weeks[i];
    // An unnamed stage sits at its proportional share of the total span, so a
    // list of stages with no week numbers at all still comes out evenly
    // spaced across the same overall length.
    const week = named ?? ((i + 1) / stages.length) * lastWeek;
    return {
      label: stage.label,
      detail: stage.detail,
      dueAt: addDays(startDate, Math.round(week * 7)),
    };
  });
}

/**
 * Dates for a list of deliverables.
 *
 * Deliverables and timeline stages rarely line up one to one, so rather than
 * pretending they do, deliverables are spread across the project span in the
 * order they were written, finishing on the project end date.
 */
export function scheduleDeliverables(
  count: number,
  startDate: Date,
  endDate: Date
): Date[] {
  if (count <= 0) return [];
  const span = Math.max(1, daysBetween(startDate, endDate));
  return Array.from({ length: count }, (_, i) =>
    addDays(startDate, Math.round((span * (i + 1)) / count))
  );
}

/** The project end date implied by its timeline, used as a default that can
 * then be edited. */
export function projectEndFromTimeline(timeline: string, startDate: Date): Date | null {
  const stages = scheduleStages(timeline, startDate);
  if (stages.length === 0) return null;
  return stages[stages.length - 1].dueAt;
}

/**
 * "in 3 days", "today", "2 days ago". Deadlines are read at a glance, and a
 * formatted date makes you do the subtraction yourself.
 *
 * Whole phrases per language rather than a word glued to a number: Spanish
 * puts the count in the middle ("dentro de 3 días") and English at the front,
 * so a shared template would not survive.
 */
export function relativeDay(target: Date, now: Date = new Date(), locale = "en"): string {
  const days = daysBetween(now, target);
  const es = locale === "es";

  if (days === 0) return es ? "hoy" : "today";
  if (days === 1) return es ? "mañana" : "tomorrow";
  if (days === -1) return es ? "ayer" : "yesterday";

  if (days > 0) {
    if (days < 14) return es ? `dentro de ${days} días` : `in ${days} days`;
    const weeks = Math.round(days / 7);
    return es ? `dentro de ${weeks} semanas` : `in ${weeks} weeks`;
  }

  const overdue = Math.abs(days);
  if (overdue < 14) return es ? `hace ${overdue} días` : `${overdue} days ago`;
  const weeks = Math.round(overdue / 7);
  return es ? `hace ${weeks} semanas` : `${weeks} weeks ago`;
}

/**
 * A short date, in the reader's language.
 *
 * The locale was hardcoded to en-GB, which put English month names on a
 * Spanish page. Passing it in keeps this a pure function, so it stays
 * testable, and the caller already knows which language it is rendering.
 */
export function formatDay(date: Date, locale: string = "en-GB"): string {
  return date.toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "short",
  });
}
