"use server";

import { requireUser } from "@/lib/session";
import { markAllRead, recentNotifications, unreadCount, type NotificationRow } from "@/lib/notify";
import type { ActionResult } from "@/actions/briefs";

/** Everything the bell needs, in one call. */
export async function notificationsAction(): Promise<
  ActionResult<{ items: NotificationRow[]; unread: number }>
> {
  const user = await requireUser();
  const [items, unread] = await Promise.all([
    recentNotifications(user.id),
    unreadCount(user.id),
  ]);
  return { ok: true, data: { items, unread } };
}

/**
 * Opening the panel is reading them.
 *
 * Never fails loudly: the notifications are already on screen, and an error
 * message about marking them read would be a worse thing to show than a badge
 * that clears a moment late.
 */
export async function markNotificationsReadAction(): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  await markAllRead(user.id);
  return { ok: true, data: undefined };
}
