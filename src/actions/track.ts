"use server";

import { revalidatePath } from "next/cache";
import { syncProject } from "@/lib/calendar-sync";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { sanitizeText, stripLongDashes } from "@/lib/sanitize-text";
import { breakDownDeliverable, type MemoryContext } from "@/lib/anthropic";
import { stepDb, flagDb, deliverableDb, type FlagKind } from "@/lib/track-db";
import { scheduleDeliverables, projectEndFromTimeline } from "@/lib/schedule";
import { tidyTitle, summaryRepeatsTitle } from "@/lib/rich-text";
import type { ActionResult } from "@/actions/briefs";

function clean(text: string): string {
  return stripLongDashes(sanitizeText(text));
}

/** Confirms the project belongs to this user (or their team) before anything
 * is written. Every action here goes through it. */
async function ownedProject(projectId: string) {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
    include: { brief: { select: { scope: true, timeline: true } } },
  });
  return { user, project };
}

async function ownedDeliverable(deliverableId: string) {
  const user = await requireFullUser();
  const deliverable = await prisma.deliverable.findFirst({
    where: { id: deliverableId, project: { ...teamScopeWhere(user) } },
    include: {
      project: {
        include: {
          brief: { select: { scope: true, timeline: true } },
          deliverables: { select: { name: true }, orderBy: { order: "asc" } },
        },
      },
    },
  });
  return { user, deliverable };
}


/** Resolves a step or flag to its deliverable, then reuses the deliverable
 * check above, so ownership is decided in exactly one place and team members
 * are treated the same everywhere. */
async function ownedVia(
  table: typeof stepDb | typeof flagDb,
  id: string
): Promise<{ deliverableId: string; projectId: string } | null> {
  const row = await table.findFirst({ where: { id } });
  if (!row) return null;
  const { deliverable } = await ownedDeliverable(row.deliverableId);
  if (!deliverable) return null;
  return { deliverableId: row.deliverableId, projectId: deliverable.projectId };
}

async function memoryFor(userId: string, user: {
  memoryInstructions: string;
  toneNotes: string;
  storyNotes: string;
  contextNotes: string;
}): Promise<MemoryContext> {
  const files = await prisma.memoryAsset.findMany({
    where: { userId, type: "FILE" },
    select: { name: true, textContent: true },
  });
  return {
    instructions: user.memoryInstructions,
    toneNotes: user.toneNotes,
    storyNotes: user.storyNotes,
    contextNotes: user.contextNotes,
    fileExcerpts: files
      .filter((f) => f.textContent)
      .map((f) => ({ name: f.name, text: f.textContent as string })),
  };
}

/**
 * Sets when the work starts, and fills in the dates that follow from it.
 *
 * The quote already says how long things take in relative terms. This is the
 * one piece of information that turns that into a calendar, so it does the
 * whole schedule in one go rather than asking for a date per deliverable.
 */
export async function scheduleProjectAction(
  projectId: string,
  startDateISO: string,
  dueDateISO?: string
): Promise<ActionResult<undefined>> {
  const { user, project } = await ownedProject(projectId);
  if (!project) return { ok: false, error: "That project no longer exists." };

  const startDate = new Date(startDateISO);
  if (Number.isNaN(startDate.getTime())) return { ok: false, error: "That start date isn't valid." };

  const timeline = project.brief?.timeline || project.timeline;
  const explicitDue = dueDateISO ? new Date(dueDateISO) : null;
  const dueDate =
    explicitDue && !Number.isNaN(explicitDue.getTime())
      ? explicitDue
      : projectEndFromTimeline(timeline, startDate) ??
        new Date(startDate.getTime() + 28 * 24 * 60 * 60 * 1000);

  if (dueDate <= startDate) {
    return { ok: false, error: "The end date needs to be after the start date." };
  }

  const deliverables = await prisma.deliverable.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const dates = scheduleDeliverables(deliverables.length, startDate, dueDate);

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { startDate, dueDate } as unknown as Parameters<
        typeof prisma.project.update
      >[0]["data"],
    }),
    ...deliverables.map((d, i) =>
      prisma.deliverable.update({
        where: { id: d.id },
        data: { dueAt: dates[i] } as unknown as Parameters<
          typeof prisma.deliverable.update
        >[0]["data"],
      })
    ),
  ]);

  // After the write, never before: an event for a change that then failed to
  // save is a wrong date in somebody's calendar, which is worse than none.
  await syncProject(user.id, projectId);

  revalidatePath(`/track/${projectId}`);
  revalidatePath("/track");
  return { ok: true, data: undefined };
}

/** Moves one deliverable's date without touching the rest of the schedule. */
export async function setDeliverableDueAction(
  deliverableId: string,
  dueAtISO: string | null
): Promise<ActionResult<undefined>> {
  const { deliverable } = await ownedDeliverable(deliverableId);
  if (!deliverable) return { ok: false, error: "That deliverable no longer exists." };

  const dueAt = dueAtISO ? new Date(dueAtISO) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) return { ok: false, error: "That date isn't valid." };

  await deliverableDb.update({ where: { id: deliverableId }, data: { dueAt } });
  await syncProject(deliverable.project.userId, deliverable.projectId);
  revalidatePath(`/track/${deliverable.projectId}`);
  return { ok: true, data: undefined };
}

/**
 * Breaks a deliverable into steps and flags.
 *
 * Regenerating replaces the AI's own suggestions but leaves hand-added and
 * ticked steps alone, since losing work you did by hand because you pressed a
 * refresh button is the kind of thing that stops people pressing it.
 */
export async function breakDownDeliverableAction(
  deliverableId: string
): Promise<ActionResult<undefined>> {
  const { user, deliverable } = await ownedDeliverable(deliverableId);
  if (!deliverable) return { ok: false, error: "That deliverable no longer exists." };

  const project = deliverable.project;

  let breakdown;
  try {
    breakdown = await breakDownDeliverable(await memoryFor(user.id, user), {
      projectTitle: project.title,
      client: project.client,
      deliverable: deliverable.name,
      siblingDeliverables: project.deliverables.map((d) => d.name),
      scope: project.brief?.scope ?? undefined,
      timeline: project.brief?.timeline || project.timeline || undefined,
      projectHours: project.hours || undefined,
    });
  } catch (err) {
    console.error("[breakDownDeliverableAction] failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't break that down right now.",
    };
  }

  const existing = await stepDb.findMany({
    where: { deliverableId },
    orderBy: { order: "asc" },
  });
  const keep = existing.filter((s) => s.done);
  const keptNames = new Set(keep.map((s) => s.name.trim().toLowerCase()));

  await stepDb.deleteMany({ where: { deliverableId, done: false } });
  await flagDb.deleteMany({ where: { deliverableId, resolved: false } });

  const fresh = breakdown.steps
    .map((s) => ({ ...s, name: clean(s.name) }))
    .filter((s) => !keptNames.has(s.name.trim().toLowerCase()));

  if (fresh.length) {
    await stepDb.createMany({
      data: fresh.map((s, i) => ({
        deliverableId,
        name: s.name,
        order: keep.length + i,
        estimateHours: s.estimateHours,
      })),
    });
  }

  if (breakdown.flags.length) {
    await flagDb.createMany({
      data: breakdown.flags.map((f) => ({
        deliverableId,
        question: clean(f.question),
        reason: clean(f.reason),
        kind: f.kind as FlagKind,
      })),
    });
  }

  // The client-facing sentence becomes a short title, since this list is the
  // freelancer's own work rather than something a client reads. Brevity is
  // enforced here rather than trusted to the prompt, which the model does not
  // always honour.
  const title = tidyTitle(clean(breakdown.title || deliverable.name));
  const summary = clean(breakdown.summary);

  await deliverableDb.update({
    where: { id: deliverableId },
    data: {
      // A summary that just restates the title is the same sentence twice.
      summary: summaryRepeatsTitle(summary, title) ? null : summary,
      name: title,
      brokenDownAt: new Date(),
    },
  });

  revalidatePath(`/track/${project.id}`);
  return { ok: true, data: undefined };
}

export async function toggleStepAction(
  stepId: string,
  done: boolean
): Promise<ActionResult<undefined>> {
  const owned = await ownedVia(stepDb, stepId);
  if (!owned) return { ok: false, error: "That step no longer exists." };

  await stepDb.update({ where: { id: stepId }, data: { done } });
  revalidatePath(`/track/${owned.projectId}`);
  return { ok: true, data: undefined };
}

/**
 * Replaces a deliverable's steps with a new list.
 *
 * Steps are edited as text, one per line, so a save is a whole new list rather
 * than a set of individual edits. Ticked steps that survive the edit keep
 * their ticks: matching on the text misses a reworded line, but losing an
 * afternoon of ticked boxes to a typo fix is worse than occasionally
 * resetting one.
 */
export async function replaceStepsAction(
  deliverableId: string,
  names: string[]
): Promise<ActionResult<undefined>> {
  const { deliverable } = await ownedDeliverable(deliverableId);
  if (!deliverable) return { ok: false, error: "That deliverable no longer exists." };

  const cleaned = names
    .map((n) => sanitizeText(n.trim()))
    .filter(Boolean)
    .slice(0, 30);

  const existing = await stepDb.findMany({ where: { deliverableId } });
  const wasDone = new Set(
    existing.filter((st) => st.done).map((st) => st.name.trim().toLowerCase())
  );
  const estimates = new Map(
    existing.map((st) => [st.name.trim().toLowerCase(), st.estimateHours])
  );

  await stepDb.deleteMany({ where: { deliverableId } });
  if (cleaned.length) {
    await stepDb.createMany({
      data: cleaned.map((name, i) => ({
        deliverableId,
        name,
        order: i,
        estimateHours: estimates.get(name.toLowerCase()) ?? 0,
      })),
    });
    // createMany can't set a different `done` per row, so the ticks are
    // reapplied in one pass afterwards.
    const keep = cleaned.filter((n) => wasDone.has(n.toLowerCase()));
    if (keep.length) {
      await stepDb.updateMany({
        where: { deliverableId, name: { in: keep } },
        data: { done: true },
      });
    }
  }

  revalidatePath(`/track/${deliverable.projectId}`);
  return { ok: true, data: undefined };
}

export async function resolveFlagAction(
  flagId: string,
  resolved: boolean
): Promise<ActionResult<undefined>> {
  const owned = await ownedVia(flagDb, flagId);
  if (!owned) return { ok: false, error: "That question no longer exists." };

  await flagDb.update({ where: { id: flagId }, data: { resolved } });
  revalidatePath(`/track/${owned.projectId}`);
  return { ok: true, data: undefined };
}


/**
 * Breaks down the next deliverable that has not been done yet.
 *
 * One per call on purpose. Doing all of them inside send-to-track would mean
 * a redirect that hangs for a minute and risks the function timeout, and a
 * single call that breaks down six deliverables at once gives six shallow
 * answers. The tracker calls this in a loop on arrival, so the work appears a
 * piece at a time with something to watch.
 */
export async function breakDownNextAction(
  projectId: string
): Promise<ActionResult<{ remaining: number; name: string | null }>> {
  const { project } = await ownedProject(projectId);
  if (!project) return { ok: false, error: "That project no longer exists." };

  const pending = await deliverableDb.findMany({
    where: { projectId, brokenDownAt: null },
    orderBy: { order: "asc" },
  });
  if (pending.length === 0) return { ok: true, data: { remaining: 0, name: null } };

  const next = pending[0];
  const result = await breakDownDeliverableAction(next.id);
  if (!result.ok) return { ok: false, error: result.error };

  return { ok: true, data: { remaining: pending.length - 1, name: next.name } };
}

/** How many deliverables still need breaking down, so the tracker knows
 * whether to start. */
export async function pendingBreakdownCountAction(
  projectId: string
): Promise<ActionResult<number>> {
  const { project } = await ownedProject(projectId);
  if (!project) return { ok: false, error: "That project no longer exists." };
  const count = await deliverableDb.count({ where: { projectId, brokenDownAt: null } });
  return { ok: true, data: count };
}
