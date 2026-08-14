import { prisma } from "@/lib/prisma";

/**
 * Recording what happened, for counting later.
 *
 * Written from the server, from the same code that did the thing. That is the
 * whole design and it has three consequences worth naming.
 *
 * An ad blocker cannot silence it, so the numbers do not quietly under-report
 * for exactly the technical users most likely to block scripts.
 *
 * No third party receives anything, so there is nothing to disclose, no cookie
 * banner, and no second copy of a freelancer's client list living somewhere
 * else.
 *
 * And it only records what the code deliberately says. There is no automatic
 * page view, no session recording, no scroll depth. Those answer questions
 * nobody here is asking, and collecting them turns a product database into a
 * surveillance one. If a question cannot be answered from this list, the answer
 * is to add one event on purpose, not to start hoovering.
 *
 * Never throws and is never awaited on a user's path. Analytics failing is not
 * a reason for a quote to fail.
 */

export type EventKind =
  // The core loop, in order.
  | "quote_generated"
  | "quote_published"
  | "quote_accepted"
  | "quote_won"
  | "quote_lost"
  | "project_tracked"
  | "deliverable_done"
  | "project_finished"
  | "invoice_created"
  | "diary_published"
  | "diary_entry_added"
  // Account shape, for reading the rest against.
  | "signed_up"
  | "onboarding_finished";

/**
 * The detail carried alongside an event.
 *
 * Numbers and short enumerated strings only. Never free text somebody typed,
 * never a client's name, never anything from a brief: those are somebody's
 * business and they are not needed to count anything.
 */
export interface EventDetail {
  price?: number;
  hours?: number;
  currency?: string;
  language?: string;
  /** "HOUR" | "DAY" | "FIXED". */
  rateUnit?: string;
  /** Whether the price came from research rather than a stated rate. */
  researched?: boolean;
  /** How many deliverables, milestones, sections. Counts, not contents. */
  count?: number;
  /** Seconds, where something is worth timing. */
  seconds?: number;
}

/**
 * Records one event.
 *
 * Call it without awaiting. Every caller is on somebody's critical path and
 * none of them should slow down, let alone fail, because a row could not be
 * written.
 */
export function track(
  kind: EventKind,
  options: { userId?: string | null; subjectId?: string | null; detail?: EventDetail } = {}
): void {
  void (async () => {
    try {
      await (prisma as unknown as {
        event: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
      }).event.create({
        data: {
          kind,
          userId: options.userId ?? null,
          subjectId: options.subjectId ?? null,
          detail: options.detail ? (options.detail as Record<string, unknown>) : undefined,
        },
      });
    } catch (err) {
      // A missing row is a gap in a chart. A thrown error here would be a
      // person unable to send a quote.
      console.error("[events] could not record", kind, err);
    }
  })();
}
