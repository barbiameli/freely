"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { stepDb } from "@/lib/track-db";
import { changesForMove, columnOf, reorder, type Column } from "@/lib/board";
import { autoSchedule, overrunDays } from "@/lib/timeline-plan";
import type { ActionResult } from "@/actions/briefs";

/**
 * Moving one card, which is the only thing the board does to the database.
 *
 * The whole column is rewritten rather than one order value, because order is
 * only meaningful within a column and writing a single number leaves ties.
 * Ties on a board look like cards swapping places at random after a reload,
 * which reads as the app losing your work.
 *
 * All of it in one transaction: a move that ticks a task off and reorders four
 * others, half applied, is a board that disagrees with itself.
 */
/**
 * The project a task belongs to, or null when it is not this person's.
 *
 * A Step has no owner of its own and the id arrives from the browser, so
 * every action here goes through this rather than trusting it.
 */
async function projectForStep(
  stepId: string,
  user: { id: string }
): Promise<{ id: string } | null> {
  const step = await stepDb.findFirst({ where: { id: stepId } });
  if (!step) return null;
  const deliverable = await prisma.deliverable.findFirst({
    where: { id: step.deliverableId },
    select: { projectId: true },
  });
  if (!deliverable) return null;
  return prisma.project.findFirst({
    where: { id: deliverable.projectId, ...teamScopeWhere(user as never) },
    select: { id: true },
  });
}

export async function moveStepAction(
  stepId: string,
  target: Column,
  index: number
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();

  // Scoped through the project, since a Step has no owner of its own and the
  // id arrives from the browser.
  const step = await stepDb.findFirst({ where: { id: stepId } });
  if (!step) return { ok: false, error: "That task no longer exists." };

  const deliverable = await prisma.deliverable.findFirst({
    where: { id: step.deliverableId },
    select: { projectId: true },
  });
  if (!deliverable) return { ok: false, error: "That task no longer exists." };

  const project = await prisma.project.findFirst({
    where: { id: deliverable.projectId, ...teamScopeWhere(user) },
    select: { id: true },
  });
  if (!project) return { ok: false, error: "That task no longer exists." };

  // Every step on the project, since a card can move between deliverables'
  // columns and the order is per column rather than per deliverable.
  const all = await stepDb.findMany({
    where: { deliverable: { projectId: project.id } },
    orderBy: { order: "asc" },
  });

  const from = columnOf({ done: step.done, startedAt: step.startedAt?.toISOString() ?? null });
  const changes = changesForMove(from, target, step.startedAt);

  // The column as it will be once this card has left wherever it was.
  const settled = all
    .filter((row) => row.id !== stepId)
    .filter(
      (row) =>
        columnOf({ done: row.done, startedAt: row.startedAt?.toISOString() ?? null }) === target
    )
    .map((row) => row.id);

  const ordered = reorder(settled, stepId, index);

  try {
    await prisma.$transaction([
      ...ordered.map((id, position) =>
        stepDb.update({
          where: { id },
          data: id === stepId ? { ...changes, order: position } : { order: position },
        })
      ),
    ] as unknown as Parameters<typeof prisma.$transaction>[0]);
  } catch (err) {
    console.error("[moveStepAction] failed", err);
    return { ok: false, error: "Couldn't move that one. Try again." };
  }

  revalidatePath(`/track/${project.id}`);
  return { ok: true, data: undefined };
}

/**
 * Placing one task on the calendar.
 *
 * Dates arrive as day strings rather than timestamps, because that is what a
 * calendar day is, and stored at UTC midnight so the bar lands on the same
 * column wherever the plan is opened. See lib/timeline-plan.
 */
export async function placeTaskAction(
  stepId: string,
  startDay: string,
  endDay: string
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const project = await projectForStep(stepId, user);
  if (!project) return { ok: false, error: "That task no longer exists." };

  const start = new Date(`${startDay}T00:00:00.000Z`);
  const end = new Date(`${endDay}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "That date didn't make sense." };
  }
  // A bar cannot end before it starts. Dragging the left edge past the right
  // would otherwise store a negative span and draw nothing at all.
  const [from, to] = end < start ? [end, start] : [start, end];

  try {
    await stepDb.update({
      where: { id: stepId },
      data: { plannedStart: from, plannedEnd: to },
    });
  } catch (err) {
    console.error("[placeTaskAction] failed", err);
    return { ok: false, error: "Couldn't move that one. Try again." };
  }

  revalidatePath(`/track/${project.id}`);
  return { ok: true, data: undefined };
}

/**
 * Laying the whole project out from its start date.
 *
 * Arithmetic, not a model call: see lib/timeline-plan for why. It overwrites
 * every unfinished task's dates, which is what "plan it for me" means, and it
 * is why the button says so rather than sitting quietly in a corner.
 */
export async function autoScheduleAction(
  projectId: string
): Promise<ActionResult<{ overrunDays: number }>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
    include: { deliverables: { orderBy: { order: "asc" } } },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const start = (project as unknown as { startDate: Date | null }).startDate;
  if (!start) return { ok: false, error: "Give the project a start date first." };

  const steps = await stepDb.findMany({
    where: { deliverable: { projectId: project.id } },
    orderBy: { order: "asc" },
  });

  const plan = autoSchedule(
    steps.map((step) => ({
      id: step.id,
      name: step.name,
      deliverableId: step.deliverableId,
      estimateHours: step.estimateHours,
      order: step.order,
      done: step.done,
      plannedStart: null,
      plannedEnd: null,
    })),
    start,
    project.deliverables.map((d) => d.id)
  );

  try {
    await prisma.$transaction(
      plan.map((placement) =>
        stepDb.update({
          where: { id: placement.id },
          data: { plannedStart: placement.start, plannedEnd: placement.end },
        })
      ) as unknown as Parameters<typeof prisma.$transaction>[0]
    );
  } catch (err) {
    console.error("[autoScheduleAction] failed", err);
    return { ok: false, error: "Couldn't lay that out. Try again." };
  }

  revalidatePath(`/track/${project.id}`);
  return {
    ok: true,
    data: {
      overrunDays: overrunDays(plan, (project as unknown as { dueDate: Date | null }).dueDate),
    },
  };
}
