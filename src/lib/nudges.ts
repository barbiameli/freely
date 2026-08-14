/**
 * Who is worth emailing today, and about what.
 *
 * A nudge is the easiest feature in any product to get wrong, because the
 * version that is easy to build is the version that gets the sender's domain
 * marked as spam: send whenever the condition is true, and somebody with four
 * untracked quotes gets four emails on Tuesday and four more on Wednesday.
 *
 * So this decides rather than reports. It takes everything already known about
 * a person, applies the limits, and returns at most one message. Pure, because
 * the interesting failures here are all about counting and timing and those are
 * exactly what a test can hold still.
 *
 * The limits, and why each one:
 *
 * One email a day, whatever is happening. Two things being wrong at once is not
 * a reason to write twice.
 *
 * Nothing at the weekend. A tracker reminder on a Sunday morning is not a
 * service, and freelancing already leaks into weekends without help.
 *
 * A gap per subject. The same quote must not be mentioned two days running: if
 * they did not act the first time, the second time is nagging.
 *
 * And nothing at all in the first few days of an account. Somebody who signed
 * up yesterday has one quote and no history, and a nudge is a reminder about a
 * habit they have not formed yet.
 */

export type NudgeKind = "NUDGE_TRACK_QUOTE" | "NUDGE_DUE_SOON" | "NUDGE_OVERDUE";

/** One a day, at most, across every kind. */
export const MIN_HOURS_BETWEEN_NUDGES = 20;

/** The same subject is not raised again inside this. */
export const MIN_DAYS_BETWEEN_SAME_SUBJECT = 6;

/** Nothing until an account has had a chance to be used. */
export const QUIET_DAYS_AFTER_SIGNUP = 3;

/** How far ahead "due soon" looks. */
export const DUE_SOON_DAYS = 2;

export interface NudgeCandidateQuote {
  id: string;
  title: string;
  client: string;
  /** When it was accepted, or created if it never was. */
  since: Date;
  /** Already in Track. Nothing to nudge about. */
  tracked: boolean;
  /** The client signed it, which makes an untracked quote much more worth
   * mentioning. */
  accepted: boolean;
}

export interface NudgeCandidateDeliverable {
  id: string;
  name: string;
  projectId: string;
  projectTitle: string;
  dueAt: Date;
  done: boolean;
}

export interface NudgeInput {
  now: Date;
  createdAt: Date;
  /** Off, and nothing is sent. */
  nudgeEmails: boolean;
  /** Whatever kind, whenever. */
  lastNudgeAt: Date | null;
  /** When each subject was last mentioned, keyed by its id. */
  lastBySubject: Record<string, Date>;
  quotes: NudgeCandidateQuote[];
  deliverables: NudgeCandidateDeliverable[];
}

export interface Nudge {
  kind: NudgeKind;
  /** The brief or project this is about, so the log can stop it repeating. */
  subjectId: string;
  /** Filled into the copy. */
  title: string;
  client?: string;
  /** How many others there are, for "and 3 more". */
  others: number;
  /** Where the link goes. */
  path: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Saturday or Sunday, in the server's reckoning. */
function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

/**
 * The one thing worth saying today, or nothing.
 *
 * Order is by consequence rather than by age. An overdue deliverable is money
 * and a client relationship; a signed quote that never reached Track is the
 * thing this app exists to prevent; a date coming up is a courtesy. Anything
 * quieter than that is not worth an email at all.
 */
export function nudgeFor(input: NudgeInput): Nudge | null {
  const { now, createdAt, nudgeEmails, lastNudgeAt, lastBySubject } = input;

  if (!nudgeEmails) return null;
  if (isWeekend(now)) return null;
  if (daysBetween(createdAt, now) < QUIET_DAYS_AFTER_SIGNUP) return null;
  if (lastNudgeAt && now.getTime() - lastNudgeAt.getTime() < MIN_HOURS_BETWEEN_NUDGES * 3600_000) {
    return null;
  }

  const recentlyMentioned = (id: string) => {
    const last = lastBySubject[id];
    return Boolean(last && daysBetween(last, now) < MIN_DAYS_BETWEEN_SAME_SUBJECT);
  };

  // Past its date and still not ticked.
  const overdue = input.deliverables
    .filter((d) => !d.done && d.dueAt.getTime() < now.getTime())
    .filter((d) => !recentlyMentioned(d.projectId))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  if (overdue.length > 0) {
    const first = overdue[0];
    return {
      kind: "NUDGE_OVERDUE",
      subjectId: first.projectId,
      title: first.name,
      client: first.projectTitle,
      others: overdue.length - 1,
      path: `/track/${first.projectId}`,
    };
  }

  // Signed, and never made it into Track. The gap this app exists to close.
  const untracked = input.quotes
    .filter((q) => !q.tracked && q.accepted)
    .filter((q) => !recentlyMentioned(q.id))
    .sort((a, b) => a.since.getTime() - b.since.getTime());
  if (untracked.length > 0) {
    const first = untracked[0];
    return {
      kind: "NUDGE_TRACK_QUOTE",
      subjectId: first.id,
      title: first.title,
      client: first.client,
      others: untracked.length - 1,
      path: `/quote/${first.id}`,
    };
  }

  // Coming up. The gentlest of the three, and the only one that is not about
  // something having gone wrong.
  const soon = input.deliverables
    .filter((d) => !d.done)
    .filter((d) => {
      const days = daysBetween(now, d.dueAt);
      return days >= 0 && days <= DUE_SOON_DAYS;
    })
    .filter((d) => !recentlyMentioned(d.projectId))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  if (soon.length > 0) {
    const first = soon[0];
    return {
      kind: "NUDGE_DUE_SOON",
      subjectId: first.projectId,
      title: first.name,
      client: first.projectTitle,
      others: soon.length - 1,
      path: `/track/${first.projectId}`,
    };
  }

  return null;
}
