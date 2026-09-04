"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { listTimedEvents, upsertEvent } from "@/lib/google-calendar";
import {
  minutesBetween,
  modeForProject,
  secondsBetween,
  secondsOf,
  parseTimeMode,
  tracksTime,
  type TimeMode,
} from "@/lib/time-tracking";
import type { ActionResult } from "@/actions/briefs";

/**
 * Starting, stopping and importing time.
 *
 * The table is newer than the generated client in some environments, so it is
 * reached through a narrow shape rather than by name. Contained here, the same
 * pattern the benchmark and client reads use.
 */
interface EntryRow {
  id: string;
  projectId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  minutes: number;
  seconds: number;
  note: string;
}

function table() {
  return (
    prisma as unknown as {
      timeEntry: {
        findFirst(args: Record<string, unknown>): Promise<EntryRow | null>;
        findMany(args: Record<string, unknown>): Promise<EntryRow[]>;
        create(args: { data: Record<string, unknown> }): Promise<EntryRow>;
        update(args: {
          where: { id: string };
          data: Record<string, unknown>;
        }): Promise<EntryRow>;
        delete(args: { where: { id: string } }): Promise<unknown>;
        createMany(args: {
          data: Record<string, unknown>[];
          skipDuplicates?: boolean;
        }): Promise<{ count: number }>;
      };
    }
  ).timeEntry;
}

/**
 * The mode for one engagement, which is where the answer lives.
 *
 * Read whole rather than by column: these are newer than the generated client
 * in some environments.
 */
async function modeForProjectId(
  userId: string,
  projectId: string
): Promise<TimeMode | null> {
  const [account, project] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.project.findUnique({ where: { id: projectId } }),
  ]);
  if (!project) return null;
  return modeForProject(
    project as unknown as { timeTracking?: unknown },
    (account ?? {}) as unknown as { timeTracking?: unknown; timeTrackingAsk?: unknown }
  );
}

/** The timer that is running, if one is. */
export async function runningEntryAction(): Promise<
  ActionResult<{ id: string; projectId: string | null; startedAt: string } | null>
> {
  try {
    const user = await requireFullUser();
    const running = await table().findFirst({
      where: { userId: user.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    return {
      ok: true,
      data: running
        ? {
            id: running.id,
            projectId: running.projectId,
            startedAt: running.startedAt.toISOString(),
          }
        : null,
    };
  } catch {
    return { ok: false, error: "Couldn't read the timer." };
  }
}

/**
 * Starting the clock on a project.
 *
 * One running entry per account, and starting a second stops the first rather
 * than refusing. Somebody who has moved on to other work has moved on; making
 * them find and stop the old timer first is a rule that exists for the
 * database rather than for them.
 */
export async function startTimerAction(
  projectId: string,
  note = ""
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireFullUser();
    const project = await prisma.project.findFirst({
      where: { id: projectId, ...teamScopeWhere(user) },
    });
    if (!project) return { ok: false, error: "Project not found." };

    const mode = await modeForProjectId(user.id, projectId);
    if (!mode || !tracksTime(mode)) {
      return { ok: false, error: "Set up the tracker on this project first." };
    }

    await stopRunning(user.id);

    const created = await table().create({
      data: {
        userId: user.id,
        projectId: project.id,
        clientId: (project as unknown as { clientId?: string | null }).clientId ?? null,
        startedAt: new Date(),
        note: note.slice(0, 200),
        source: "TIMER",
      },
    });
    revalidatePath(`/track/${projectId}`);
    return { ok: true, data: { id: created.id } };
  } catch {
    return { ok: false, error: "Couldn't start the timer." };
  }
}

/** Closes whatever is running, and returns how long it was. */
async function stopRunning(userId: string): Promise<EntryRow | null> {
  const running = await table().findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!running) return null;

  const endedAt = new Date();
  // Both, so nothing that already reads minutes has to change and nothing
  // rounds a fifty-second session down to nothing. See lib/time-tracking.
  return table().update({
    where: { id: running.id },
    data: {
      endedAt,
      minutes: minutesBetween(running.startedAt, endedAt),
      seconds: secondsBetween(running.startedAt, endedAt),
    },
  });
}

/**
 * Stopping, and writing the block into the calendar.
 *
 * The event is best effort and never blocks the stop: a calendar being
 * unreachable must not lose somebody's afternoon. It is written after the
 * fact rather than live, because an event that appears when you start and
 * grows as you work is a calendar nobody can read.
 */
export async function stopTimerAction(): Promise<ActionResult<{ minutes: number }>> {
  try {
    const user = await requireFullUser();
    const stopped = await stopRunning(user.id);
    if (!stopped) return { ok: false, error: "Nothing was running." };

    // Under ten seconds is a misclick, not a work session. It used to be a
    // minute, which threw away the shortest real thing anybody does: a two
    // minute call, or forty seconds of fixing a typo somebody flagged.
    if (secondsOf(stopped) < 10) {
      await table().delete({ where: { id: stopped.id } });
      return { ok: true, data: { minutes: 0 } };
    }

    if (stopped.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: stopped.projectId },
        select: { title: true },
      });
      const eventId = await upsertEvent(user.id, {
        title: stopped.note || project?.title || "Work",
        date: stopped.startedAt,
        description: project?.title ?? "",
      });
      if (eventId) {
        await table().update({ where: { id: stopped.id }, data: { calendarEventId: eventId } });
      }
      revalidatePath(`/track/${stopped.projectId}`);
    }

    return { ok: true, data: { minutes: stopped.minutes } };
  } catch {
    return { ok: false, error: "Couldn't stop the timer." };
  }
}

/** Time typed in from memory, which is most of it. */
export async function addTimeAction(input: {
  projectId: string;
  minutes: number;
  note?: string;
  billable?: boolean;
  on?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireFullUser();
    const mode = await modeForProjectId(user.id, input.projectId);
    if (!mode || !tracksTime(mode)) {
      return { ok: false, error: "Set up the tracker on this project first." };
    }
    if (!Number.isFinite(input.minutes) || input.minutes <= 0 || input.minutes > 24 * 60) {
      return { ok: false, error: "Give a length between 1 minute and 24 hours." };
    }

    const project = await prisma.project.findFirst({
      where: { id: input.projectId, ...teamScopeWhere(user) },
    });
    if (!project) return { ok: false, error: "Project not found." };

    const startedAt = input.on ? new Date(input.on) : new Date();
    if (Number.isNaN(startedAt.getTime())) {
      return { ok: false, error: "That is not a date." };
    }

    const created = await table().create({
      data: {
        userId: user.id,
        projectId: project.id,
        clientId: (project as unknown as { clientId?: string | null }).clientId ?? null,
        startedAt,
        endedAt: new Date(startedAt.getTime() + Math.round(input.minutes) * 60_000),
        minutes: Math.round(input.minutes),
        seconds: Math.round(input.minutes) * 60,
        note: (input.note ?? "").slice(0, 200),
        billable: input.billable !== false,
        source: "MANUAL",
      },
    });
    revalidatePath(`/track/${input.projectId}`);
    return { ok: true, data: { id: created.id } };
  } catch {
    return { ok: false, error: "Couldn't save that." };
  }
}

export async function deleteTimeAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const user = await requireFullUser();
    const entry = await table().findFirst({ where: { id, userId: user.id } });
    if (!entry) return { ok: false, error: "Not found." };
    await table().delete({ where: { id } });
    if (entry.projectId) revalidatePath(`/track/${entry.projectId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Couldn't delete that." };
  }
}

/**
 * Pulling in the blocks somebody already made in their calendar.
 *
 * Matched on the project's title appearing in the event, which is the way
 * people actually name a block: "Ergo redesign", "Briefer handover call". A
 * looser match would claim a client's own meeting as work on their project.
 *
 * Nothing is counted twice: the unique index on the event id means a second
 * import of the same fortnight adds nothing, and `skipDuplicates` makes that
 * silent rather than an error.
 */
export async function importCalendarTimeAction(
  projectId: string,
  days = 14
): Promise<ActionResult<{ added: number }>> {
  try {
    const user = await requireFullUser();
    const mode = await modeForProjectId(user.id, projectId);
    if (!mode || !tracksTime(mode)) {
      return { ok: false, error: "Set up the tracker on this project first." };
    }

    // Read whole rather than by column: clientId is newer than the generated
    // client in some environments, and a named select would not compile there.
    const project = await prisma.project.findFirst({
      where: { id: projectId, ...teamScopeWhere(user) },
    });
    if (!project) return { ok: false, error: "Project not found." };

    const to = new Date();
    const from = new Date(to.getTime() - Math.min(days, 90) * 86_400_000);
    const events = await listTimedEvents(user.id, from, to);

    const needle = project.title.toLowerCase().slice(0, 40);
    const clientNeedle = project.client.toLowerCase();
    const mine = events.filter((event) => {
      const title = event.title.toLowerCase();
      return (
        (needle.length > 3 && title.includes(needle)) ||
        (clientNeedle.length > 3 && title.includes(clientNeedle))
      );
    });

    if (mine.length === 0) return { ok: true, data: { added: 0 } };

    const { count } = await table().createMany({
      data: mine.map((event) => ({
        userId: user.id,
        projectId: project.id,
        clientId: (project as unknown as { clientId?: string | null }).clientId ?? null,
        startedAt: event.start,
        endedAt: event.end,
        minutes: minutesBetween(event.start, event.end),
        seconds: secondsBetween(event.start, event.end),
        note: event.title.slice(0, 200),
        source: "CALENDAR",
        calendarEventId: event.id,
      })),
      skipDuplicates: true,
    });

    revalidatePath(`/track/${projectId}`);
    return { ok: true, data: { added: count } };
  } catch {
    return { ok: false, error: "Couldn't read your calendar." };
  }
}

/**
 * What you did in that time.
 *
 * The note is the part that makes a week of tracked hours worth keeping. A
 * list of durations tells you that Tuesday had six hours in it; a list with
 * lines against them tells you what those six hours bought, which is what
 * somebody needs when a client asks, or when they are working out why a job
 * ran over.
 *
 * Either typed, or taken from the deliverables already on the project, since
 * most of the time the honest answer is the name of the thing being worked on.
 */
export async function logTimeAction(input: {
  entryId: string;
  note?: string;
  deliverableId?: string | null;
  billable?: boolean;
}): Promise<ActionResult<undefined>> {
  try {
    const user = await requireFullUser();
    const entry = await table().findFirst({ where: { id: input.entryId, userId: user.id } });
    if (!entry) return { ok: false, error: "Not found." };

    // Theirs, or nothing: the id arrives from a client and points at a row on
    // a project somebody else might own.
    let deliverableId: string | null | undefined;
    if (input.deliverableId !== undefined) {
      deliverableId = null;
      if (input.deliverableId && entry.projectId) {
        const owned = await prisma.deliverable.findFirst({
          where: { id: input.deliverableId, projectId: entry.projectId },
          select: { id: true },
        });
        deliverableId = owned?.id ?? null;
      }
    }

    await table().update({
      where: { id: entry.id },
      data: {
        ...(input.note !== undefined ? { note: input.note.slice(0, 200) } : {}),
        ...(deliverableId !== undefined ? { deliverableId } : {}),
        ...(input.billable !== undefined ? { billable: input.billable } : {}),
      },
    });

    if (entry.projectId) revalidatePath(`/track/${entry.projectId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Couldn't save that." };
  }
}

/**
 * Setting up the tracker on one engagement.
 *
 * Asked once, on the project, because the answer is about this piece of work:
 * the same person tracks a fixed-price job to learn what it really cost and an
 * hourly one because the client is paying for the hours.
 *
 * Saving it as the default is offered rather than assumed, and so is being
 * asked again next time. Somebody answering this for the first time has no way
 * of knowing whether their answer generalises.
 */
export async function setProjectTimeModeAction(input: {
  projectId: string;
  mode: string;
  /** Use this on new projects too, without asking. */
  asDefault?: boolean;
}): Promise<ActionResult<undefined>> {
  try {
    const user = await requireFullUser();
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, ...teamScopeWhere(user) },
      select: { id: true },
    });
    if (!project) return { ok: false, error: "Project not found." };

    const parsed = parseTimeMode(input.mode);
    await prisma.project.update({
      where: { id: project.id },
      data: { timeTracking: parsed } as unknown as Parameters<
        typeof prisma.project.update
      >[0]["data"],
    });

    if (input.asDefault) {
      await prisma.user.update({
        where: { id: user.id },
        data: { timeTracking: parsed, timeTrackingAsk: false } as unknown as Parameters<
          typeof prisma.user.update
        >[0]["data"],
      });
    }

    revalidatePath(`/track/${input.projectId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Couldn't save that." };
  }
}
