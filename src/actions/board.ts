"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { stepDb } from "@/lib/track-db";
import { changesForMove, columnOf, reorder, type Column } from "@/lib/board";
import { daysShort, firstPlan, shareOutDays, squeezed, workingDaysIn } from "@/lib/project-plan";
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
    // Interactive, not an array. The array form requires every element to be
    // a PrismaPromise and these come through a cast wrapper, so the whole
    // batch was handed over as something it would not run.
    await prisma.$transaction(async (tx) => {
      const step = (tx as unknown as { step: { update(args: unknown): Promise<unknown> } }).step;
      for (let position = 0; position < ordered.length; position += 1) {
        const id = ordered[position];
        await step.update({
          where: { id },
          data: id === stepId ? { ...changes, order: position } : { order: position },
        });
      }
    });
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
): Promise<ActionResult<{ squeezed: { name: string; has: number; needs: number }[] }>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
    include: { deliverables: { orderBy: { order: "asc" } } },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const row = project as unknown as {
    startDate: Date | null;
    dueDate: Date | null;
    hoursPerDay?: number | null;
    workingDays?: number[] | null;
  };
  if (!row.startDate) return { ok: false, error: "Give the project a start date first." };
  if (!row.dueDate) return { ok: false, error: "Give the project an end date first." };

  const steps = await stepDb.findMany({
    where: { deliverable: { projectId: project.id } },
    orderBy: { order: "asc" },
  });

  const shape = {
    hoursPerDay: row.hoursPerDay && row.hoursPerDay > 0 ? row.hoursPerDay : 6,
    workingDays: row.workingDays?.length ? row.workingDays : [1, 2, 3, 4, 5],
  };
  const deliverables = project.deliverables.map((d, index) => ({
    id: d.id,
    order: index,
    priority: (d as unknown as { priority?: number }).priority ?? 1,
  }));
  const tasks = steps.map((step) => ({
    id: step.id,
    deliverableId: step.deliverableId,
    estimateHours: step.estimateHours,
    order: step.order,
    done: step.done,
  }));

  /*
   * Fit it into the window rather than reporting that it does not.
   *
   * This used to lay the tasks end to end from the start date and then say
   * "this runs 21 working days past the due date", which is true and useless:
   * the date was agreed with a client, so running past it is not a plan, it
   * is a description of a problem. Sometimes the work simply has to happen
   * inside the time there is.
   *
   * So the days available are shared out by estimate and priority, everything
   * lands inside the window, and what got squeezed is named. That is where
   * the star earns its keep: it decides which corners get cut.
   */
  const plan = firstPlan(deliverables, tasks, row.startDate, row.dueDate, shape);
  const allocation = shareOutDays(
    deliverables,
    tasks,
    workingDaysIn(row.startDate, row.dueDate, shape.workingDays).length
  );
  const tight = squeezed(deliverables, tasks, allocation, shape.hoursPerDay);
  const names = new Map(project.deliverables.map((d) => [d.id, d.name] as const));

  try {
    // An interactive transaction rather than an array of promises. The array
    // form needs every element to be a PrismaPromise, and these come through
    // a cast wrapper, so thirty updates were being handed over as something
    // it would not run.
    await prisma.$transaction(async (tx) => {
      for (const placement of plan) {
        await (tx as unknown as {
          step: { update(args: unknown): Promise<unknown> };
        }).step.update({
          where: { id: placement.id },
          data: { plannedStart: placement.start, plannedEnd: placement.end },
        });
      }
    });
  } catch (err) {
    console.error("[autoScheduleAction] failed", err);
    return { ok: false, error: "Couldn't lay that out. Try again." };
  }

  revalidatePath(`/track/${project.id}`);
  return {
    ok: true,
    data: {
      squeezed: tight.map((entry) => ({
        name: names.get(entry.deliverableId) ?? "",
        has: entry.has,
        needs: entry.needs,
      })),
    },
  };
}

/**
 * Settling the shape of a project, and drawing the first plan from it.
 *
 * One call rather than a save followed by a plan: the two are the same act,
 * and a half-applied version leaves somebody looking at a board that does not
 * match the dates above it.
 */
export async function planProjectAction(input: {
  projectId: string;
  startDay: string;
  endDay: string;
  hoursPerDay: number;
  workingDays: number[];
  /** Deliverable ids the freelancer starred. */
  starred: string[];
}): Promise<ActionResult<{ daysShort: number }>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, ...teamScopeWhere(user) },
    include: { deliverables: { orderBy: { order: "asc" } } },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const start = new Date(`${input.startDay}T00:00:00.000Z`);
  const end = new Date(`${input.endDay}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Those dates didn't make sense." };
  }
  if (end < start) return { ok: false, error: "The end date is before the start." };
  if (input.workingDays.length === 0) {
    return { ok: false, error: "Pick at least one day of the week you work." };
  }

  const steps = await stepDb.findMany({
    where: { deliverable: { projectId: project.id } },
    orderBy: { order: "asc" },
  });

  const starred = new Set(input.starred);
  const deliverables = project.deliverables.map((d, index) => ({
    id: d.id,
    order: index,
    priority: starred.has(d.id) ? 2 : 1,
  }));
  const tasks = steps.map((step) => ({
    id: step.id,
    deliverableId: step.deliverableId,
    estimateHours: step.estimateHours,
    order: step.order,
    done: step.done,
  }));

  const shape = {
    workingDays: input.workingDays,
    hoursPerDay: Math.max(0.5, input.hoursPerDay),
  };
  const plan = firstPlan(deliverables, tasks, start, end, shape);

  try {
    await prisma.$transaction(async (tx) => {
      const client = tx as unknown as {
        project: { update(args: unknown): Promise<unknown> };
        deliverable: { update(args: unknown): Promise<unknown> };
        step: { update(args: unknown): Promise<unknown> };
      };
      await client.project.update({
        where: { id: project.id },
        data: {
          startDate: start,
          dueDate: end,
          hoursPerDay: shape.hoursPerDay,
          workingDays: shape.workingDays,
          plannedAt: new Date(),
        },
      });
      for (const deliverable of deliverables) {
        await client.deliverable.update({
          where: { id: deliverable.id },
          data: { priority: deliverable.priority },
        });
      }
      for (const placement of plan) {
        await client.step.update({
          where: { id: placement.id },
          data: { plannedStart: placement.start, plannedEnd: placement.end },
        });
      }
    });
  } catch (err) {
    console.error("[planProjectAction] failed", err);
    return { ok: false, error: "Couldn't save that. Try again." };
  }

  revalidatePath(`/track/${project.id}`);
  return { ok: true, data: { daysShort: daysShort(tasks, start, end, shape) } };
}
