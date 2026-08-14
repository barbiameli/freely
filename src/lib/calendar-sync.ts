import { prisma } from "@/lib/prisma";
import { upsertEvent, deleteEvent, hasCalendar } from "@/lib/google-calendar";
import { appUrl } from "@/lib/email";

/**
 * Keeping the calendar in step with the tracker.
 *
 * One function, called from every place a date can change: scheduling a
 * project, moving one deliverable, rescheduling the lot, ticking something off,
 * deleting a project. Anything that changes a date and does not call this leaves
 * an event in somebody's calendar for work that moved, which is worse than
 * having no calendar integration at all: a wrong date they trust.
 *
 * Everything here is best effort and nothing throws. The tracker is the record
 * and the calendar is a copy of it, so a copy that could not be written is a
 * thing to try again later rather than a reason to refuse the change.
 *
 * Finished work loses its event. A calendar full of deadlines that have already
 * been met is a calendar people stop reading, and the tracker still knows what
 * was done and when.
 */

interface SyncableDeliverable {
  id: string;
  name: string;
  dueAt: Date | null;
  done: boolean;
  calendarEventId?: string | null;
}

/** Written on the event so it is obvious where it came from and how to get back. */
function describe(projectId: string, projectTitle: string): string {
  return `${projectTitle} in Freely.\n${appUrl()}/track/${projectId}`;
}

/**
 * Brings one project's deliverables into line.
 *
 * Creates what is missing, updates what moved, removes what is finished or no
 * longer dated. Runs after the database has been written, never before: an
 * event for a change that then failed to save is a lie in somebody's calendar.
 */
export async function syncProject(userId: string, projectId: string): Promise<void> {
  try {
    if (!(await hasCalendar(userId))) return;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { deliverables: true },
    });
    if (!project) return;

    for (const raw of project.deliverables) {
      const d = raw as unknown as SyncableDeliverable;
      const eventId = d.calendarEventId ?? null;

      // Done, or no longer dated. Either way the event has no business being
      // in next week.
      if (d.done || !d.dueAt) {
        if (eventId) {
          await deleteEvent(userId, eventId);
          await prisma.deliverable.update({
            where: { id: d.id },
            data: { ...({ calendarEventId: null } as Record<string, unknown>) },
          });
        }
        continue;
      }

      const created = await upsertEvent(
        userId,
        {
          title: `${d.name} · ${project.title}`,
          date: d.dueAt,
          description: describe(project.id, project.title),
        },
        eventId
      );

      // Only written when it changed. A successful update returns the same id,
      // and writing it back every time would be a query per deliverable per
      // sync for nothing.
      if (created && created !== eventId) {
        await prisma.deliverable.update({
          where: { id: d.id },
          data: { ...({ calendarEventId: created } as Record<string, unknown>) },
        });
      }
    }
  } catch (err) {
    // The tracker is the record. A calendar that cannot be reached is not a
    // reason for a date change to fail.
    console.warn("[calendar-sync] project sync failed", err);
  }
}

/**
 * Removes every event for a project, for when the project itself goes.
 *
 * Called before the delete rather than after, since the ids live on rows that
 * are about to stop existing.
 */
export async function removeProjectEvents(userId: string, projectId: string): Promise<void> {
  try {
    if (!(await hasCalendar(userId))) return;
    const deliverables = (await prisma.deliverable.findMany({
      where: { projectId },
    })) as unknown as SyncableDeliverable[];

    for (const d of deliverables) {
      if (d.calendarEventId) await deleteEvent(userId, d.calendarEventId);
    }
  } catch (err) {
    console.warn("[calendar-sync] project cleanup failed", err);
  }
}
