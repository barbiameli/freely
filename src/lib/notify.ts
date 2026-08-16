import { prisma } from "@/lib/prisma";

/**
 * Telling somebody something happened.
 *
 * One function, called from wherever the thing actually happens, so a new
 * notification is one line at the site of the event rather than a subscription
 * somewhere else that has to be kept in step.
 *
 * Never throws. A notification is a side effect of something more important:
 * a client accepting a quote must not fail because the bell could not be
 * updated, and an error thrown from here would do exactly that.
 */

export type NotificationKind =
  | "QUOTE_ACCEPTED"
  | "INVOICE_PAID"
  | "DEADLINE"
  | "UNTRACKED"
  | "GENERAL";

export interface NewNotification {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  subjectId?: string;
}

/** The generated client here predates this table. */
const db = () =>
  (
    prisma as unknown as {
      notification: {
        create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
        findMany(args: Record<string, unknown>): Promise<NotificationRow[]>;
        count(args: Record<string, unknown>): Promise<number>;
        updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
        deleteMany(args: Record<string, unknown>): Promise<{ count: number }>;
      };
    }
  ).notification;

export interface NotificationRow {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Records one, and says nothing if it cannot.
 *
 * Also collapses repeats: the same kind about the same subject, still unread,
 * is not recorded twice. Without this a deadline that passes on Friday would
 * produce an identical line every time anything touched that project, and a
 * bell with six copies of one sentence in it is a bell people stop opening.
 */
export async function notify(n: NewNotification): Promise<void> {
  try {
    if (n.subjectId) {
      const existing = await db().count({
        where: { userId: n.userId, kind: n.kind, subjectId: n.subjectId, readAt: null },
      });
      if (existing > 0) return;
    }
    await db().create({
      data: {
        userId: n.userId,
        kind: n.kind,
        title: n.title,
        body: n.body,
        href: n.href ?? null,
        subjectId: n.subjectId ?? null,
      },
    });
  } catch (err) {
    console.error("[notify] failed", err);
  }
}

/** How many are showing on the bell. Capped, because "99+" is enough. */
export const MAX_BADGE = 9;

/** The most recent, newest first. */
export async function recentNotifications(
  userId: string,
  take = 12
): Promise<NotificationRow[]> {
  try {
    return await db().findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    });
  } catch (err) {
    console.error("[recentNotifications] failed", err);
    return [];
  }
}

export async function unreadCount(userId: string): Promise<number> {
  try {
    return await db().count({ where: { userId, readAt: null } });
  } catch {
    return 0;
  }
}

/**
 * Marks everything read.
 *
 * On opening the panel rather than per item. Opening the bell is the moment
 * somebody has seen what is in it, and asking them to also dismiss each line
 * is asking them to do the same thing twice.
 */
export async function markAllRead(userId: string): Promise<void> {
  try {
    await db().updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  } catch (err) {
    console.error("[markAllRead] failed", err);
  }
}

/** How the badge reads: a number, or a number with a plus after it. */
export function badge(count: number): string | null {
  if (count <= 0) return null;
  return count > MAX_BADGE ? `${MAX_BADGE}+` : String(count);
}
