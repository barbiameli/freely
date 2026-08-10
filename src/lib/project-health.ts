import { daysBetween } from "@/lib/schedule";

/**
 * How a project is actually doing, worked out from dates and ticked boxes.
 *
 * Deliberately rules rather than a model call: the ranking on the Track
 * dashboard has to be instant, free, the same every time you look at it, and
 * explainable in one line. The AI's job is to say what to do about the
 * result, not to compute it.
 */

export interface HealthStep {
  done: boolean;
  /** Zero when unestimated, which falls back to counting steps equally. */
  estimateHours: number;
}

export interface HealthDeliverable {
  id: string;
  name: string;
  done: boolean;
  dueAt: Date | null;
  steps: HealthStep[];
}

export interface HealthProject {
  id: string;
  title: string;
  client: string;
  status: string;
  startDate: Date | null;
  dueDate: Date | null;
  deliverables: HealthDeliverable[];
}

/**
 * Completion as a fraction.
 *
 * Steps are weighted by their estimate where there is one, so ticking off a
 * ten-minute task doesn't register as the same progress as a two-day one. A
 * deliverable with no steps counts as a whole unit, either done or not, since
 * that is all it can tell us.
 */
export function deliverableCompletion(deliverable: HealthDeliverable): number {
  const { steps, done } = deliverable;
  if (steps.length === 0) return done ? 1 : 0;

  const weight = (s: HealthStep) => (s.estimateHours > 0 ? s.estimateHours : 1);
  const total = steps.reduce((sum, s) => sum + weight(s), 0);
  if (total === 0) return done ? 1 : 0;
  const complete = steps.filter((s) => s.done).reduce((sum, s) => sum + weight(s), 0);
  // A deliverable ticked off by hand is finished whatever its steps say, since
  // the person doing the work is the authority on that.
  return done ? 1 : complete / total;
}

export function projectCompletion(project: HealthProject): number {
  const { deliverables } = project;
  if (deliverables.length === 0) return 0;
  const sum = deliverables.reduce((acc, d) => acc + deliverableCompletion(d), 0);
  return sum / deliverables.length;
}

/**
 * How far through the calendar the project is.
 *
 * Returns null when it hasn't been scheduled, in which case there is nothing
 * to compare progress against and everything downstream stays quiet rather
 * than inventing a verdict.
 */
export function elapsedFraction(project: HealthProject, now: Date = new Date()): number | null {
  const { startDate, dueDate } = project;
  if (!startDate || !dueDate) return null;
  const span = daysBetween(startDate, dueDate);
  if (span <= 0) return null;
  return Math.min(1.2, Math.max(0, daysBetween(startDate, now) / span));
}

export type Pace = "ahead" | "on track" | "slipping" | "behind" | "unscheduled";

/**
 * Progress against the calendar.
 *
 * The threshold is deliberately loose. Freelance work is lumpy: a week of
 * research produces no ticked boxes and then three land at once. A warning
 * every time someone is a day off pace would be noise, and noise gets
 * ignored, so only a real gap counts.
 */
export function pace(project: HealthProject, now: Date = new Date()): Pace {
  const elapsed = elapsedFraction(project, now);
  if (elapsed === null) return "unscheduled";
  const done = projectCompletion(project);
  if (done >= 1) return "on track";
  const gap = elapsed - done;
  if (gap <= -0.1) return "ahead";
  if (gap < 0.15) return "on track";
  if (gap < 0.3) return "slipping";
  return "behind";
}

export interface Deadline {
  deliverableId: string;
  name: string;
  dueAt: Date;
  daysAway: number;
  overdue: boolean;
}

/** Unfinished deliverables with a date, soonest first. Finished ones are not
 * deadlines, and dateless ones can't be. */
export function upcomingDeadlines(
  project: HealthProject,
  now: Date = new Date(),
  withinDays = 14
): Deadline[] {
  return project.deliverables
    .filter((d) => !d.done && d.dueAt)
    .map((d) => {
      const daysAway = daysBetween(now, d.dueAt as Date);
      return {
        deliverableId: d.id,
        name: d.name,
        dueAt: d.dueAt as Date,
        daysAway,
        overdue: daysAway < 0,
      };
    })
    .filter((d) => d.daysAway <= withinDays)
    .sort((a, b) => a.daysAway - b.daysAway);
}

export interface Friction {
  /** Short enough to read in a list. */
  title: string;
  /** One line of explanation. Kept short: this is a summary, and the detail
   * lives in the deliverables below it. */
  detail?: string;
  /** The deliverables involved, as separate items. Joining these into one
   * sentence produced a wall of text, because a quote's deliverables are
   * often written as whole descriptive sentences rather than short names. */
  items?: string[];
  severity: "high" | "medium" | "low";
}

/**
 * What is actually going wrong, in plain terms.
 *
 * Only things the data can support. No advice, no speculation: a list that
 * mixes real problems with generic project-management wisdom teaches people
 * to skim past all of it.
 */
export function frictionPoints(
  project: HealthProject,
  openBlockers: number,
  now: Date = new Date()
): Friction[] {
  const out: Friction[] = [];
  const overdue = upcomingDeadlines(project, now).filter((d) => d.overdue);

  if (overdue.length > 0) {
    out.push({
      title: `${overdue.length} deliverable${overdue.length === 1 ? "" : "s"} past the date`,
      items: overdue.map((d) => d.name),
      severity: "high",
    });
  }

  if (openBlockers > 0) {
    out.push({
      title: `${openBlockers} unanswered question${openBlockers === 1 ? "" : "s"} blocking work`,
      detail: "Work on those deliverables is proceeding on guesses until they are answered.",
      severity: "high",
    });
  }

  const current = pace(project, now);
  if (current === "behind" || current === "slipping") {
    const done = Math.round(projectCompletion(project) * 100);
    const elapsed = Math.round((elapsedFraction(project, now) ?? 0) * 100);
    out.push({
      title: current === "behind" ? "Behind the schedule" : "Slipping behind",
      detail: `${elapsed}% of the time is gone and ${done}% of the work is done.`,
      severity: current === "behind" ? "high" : "medium",
    });
  }

  const unbroken = project.deliverables.filter((d) => !d.done && d.steps.length === 0);
  if (unbroken.length > 0 && project.deliverables.length > 0) {
    out.push({
      title: `${unbroken.length} deliverable${unbroken.length === 1 ? "" : "s"} not broken down yet`,
      detail: "Open one and use Break this down to turn it into steps.",
      items: unbroken.map((d) => d.name),
      severity: "low",
    });
  }

  return out;
}

export interface Priority {
  projectId: string;
  /** Higher means it wants attention sooner. */
  score: number;
  /** One line saying why it sits where it does. */
  reason: string;
  pace: Pace;
  completion: number;
  nextDeadline: Deadline | null;
}

/**
 * Ranks projects by what needs attention.
 *
 * Overdue work outranks everything, then how far behind pace a project is,
 * then how close the next deadline is. Finished projects sink. The reason
 * string is what gets shown, since a number on its own tells nobody anything.
 */
export function prioritize(
  projects: HealthProject[],
  blockersByProject: Record<string, number> = {},
  now: Date = new Date()
): Priority[] {
  return projects
    .map((project) => {
      const deadlines = upcomingDeadlines(project, now, 60);
      const next = deadlines[0] ?? null;
      const overdue = deadlines.filter((d) => d.overdue).length;
      const completion = projectCompletion(project);
      const current = pace(project, now);
      const blockers = blockersByProject[project.id] ?? 0;

      let score = 0;
      let reason: string;

      if (project.status === "DONE" || completion >= 1) {
        score = -100;
        reason = "Finished.";
      } else if (overdue > 0) {
        score = 100 + overdue * 10;
        reason = `${overdue} deliverable${overdue === 1 ? "" : "s"} past the date.`;
      } else if (current === "behind") {
        score = 80;
        reason = `${Math.round(completion * 100)}% done with most of the time gone.`;
      } else if (blockers > 0) {
        score = 70;
        reason = `${blockers} unanswered question${blockers === 1 ? "" : "s"} holding work up.`;
      } else if (current === "slipping") {
        score = 60;
        reason = "Progress is behind the calendar.";
      } else if (next && next.daysAway <= 7) {
        score = 50 - next.daysAway;
        reason = `Next deadline ${next.daysAway === 0 ? "today" : `in ${next.daysAway} days`}.`;
      } else if (current === "ahead") {
        score = 5;
        reason = "Ahead of the schedule, this one can wait.";
      } else if (current === "unscheduled") {
        score = 30;
        reason = "No start date yet, so nothing can be tracked against it.";
      } else {
        score = 20;
        reason = "On track.";
      }

      return { projectId: project.id, score, reason, pace: current, completion, nextDeadline: next };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Shortens a deliverable name for a list.
 *
 * Quote deliverables are written for a client to read, so they often arrive
 * as a full sentence: a name, a comma, then everything it includes. The
 * leading clause before the first comma is nearly always the actual name, so
 * that is what gets shown, with a length cap for the ones that aren't.
 */
export function shortName(name: string, max = 60): string {
  const lead = name.split(/,|—|\s-\s/)[0].trim();
  const candidate = lead.length >= 8 ? lead : name.trim();
  // Trimmed to max including the ellipsis, so the cap means what it says.
  return candidate.length > max ? `${candidate.slice(0, max - 3).trimEnd()}...` : candidate;
}
