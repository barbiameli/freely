"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { stepDb } from "@/lib/track-db";
import { changesForMove, columnOf, reorder, type Column } from "@/lib/board";
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
