"use server";

import { revalidatePath } from "next/cache";
import { syncProject, removeProjectEvents } from "@/lib/calendar-sync";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/events";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { extractProjectFromDocument } from "@/lib/anthropic";
import type { ActionResult } from "@/actions/briefs";

export type ProjectStatusValue = "ACTIVE" | "DUE" | "OVERDUE" | "DONE";

/** Reads an uploaded brief/SOW (already text-extracted via /api/extract-text,
 * same as Quote's source step) and creates a Project directly — deliverables,
 * timeline, title, and client are all pulled from the document instead of
 * typed in by hand. */
export async function createProjectFromDocumentAction(
  sourceText: string
): Promise<ActionResult<{ projectId: string }>> {
  const user = await requireFullUser();
  if (!sourceText.trim()) {
    return { ok: false, error: "Upload a brief or SOW first." };
  }

  let extracted;
  try {
    extracted = await extractProjectFromDocument(sourceText);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't read that document right now.",
    };
  }

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      title: extracted.title,
      client: extracted.client,
      timeline: extracted.timeline,
      deliverables: {
        create: extracted.deliverables.map((name, order) => ({ name, order })),
      },
    },
  });

  revalidatePath("/track");
  return { ok: true, data: { projectId: project.id } };
}

export async function createManualProjectAction(
  title: string,
  client: string
): Promise<ActionResult<{ projectId: string }>> {
  const user = await requireFullUser();
  if (!title.trim()) return { ok: false, error: "Give the project a title." };

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      title: title.trim(),
      client: client.trim() || "New client",
    },
  });

  revalidatePath("/track");
  return { ok: true, data: { projectId: project.id } };
}

export async function updateProjectAction(
  projectId: string,
  patch: Partial<{
    title: string;
    client: string;
    price: number;
    hours: number;
    hoursLogged: number;
    timeline: string;
    status: ProjectStatusValue;
  }>
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
  });
  if (!project) return { ok: false, error: "Project not found." };

  await prisma.project.update({ where: { id: projectId }, data: patch });
  revalidatePath(`/track/${projectId}`);
  revalidatePath("/track");
  return { ok: true, data: undefined };
}

export async function toggleDeliverableAction(
  projectId: string,
  deliverableId: string
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const deliverable = await prisma.deliverable.findFirst({
    where: { id: deliverableId, projectId },
  });
  if (!deliverable) return { ok: false, error: "Deliverable not found." };

  const nowDone = !deliverable.done;
  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: {
      done: nowDone,
      // Stamped on the way to done and cleared on the way back, so unticking
      // something by mistake does not leave a completion date behind. Cast
      // because this column is newer than the generated client here.
      ...({ doneAt: nowDone ? new Date() : null } as Record<string, unknown>),
    },
  });

  // Only on the way to done. Ticking and unticking would otherwise read as
  // two days' work.
  if (nowDone) track("deliverable_done", { userId: user.id, subjectId: projectId });

  // Finished work loses its event, so the calendar is not full of deadlines
  // that were already met.
  await syncProject(user.id, projectId);

  revalidatePath(`/track/${projectId}`);
  revalidatePath("/track");
  return { ok: true, data: undefined };
}

export async function addDeliverableAction(
  projectId: string,
  name: string
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
    include: { deliverables: true },
  });
  if (!project) return { ok: false, error: "Project not found." };
  if (!name.trim()) return { ok: false, error: "Name the deliverable first." };

  await prisma.deliverable.create({
    data: { projectId, name: name.trim(), order: project.deliverables.length },
  });

  revalidatePath(`/track/${projectId}`);
  return { ok: true, data: undefined };
}

/** Permanently deletes a project — cascades to its deliverables and diary
 * entries (both `onDelete: Cascade` in schema). Does not touch the Brief it
 * may have been created from, if any. */
export async function deleteProjectAction(projectId: string): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
  });
  if (!project) return { ok: false, error: "Project not found." };

  // Before the delete: the event ids live on rows that are about to stop
  // existing, and an orphaned event is one nobody can find to remove.
  await removeProjectEvents(user.id, projectId);
  await prisma.project.delete({ where: { id: projectId } });

  revalidatePath("/track");
  revalidatePath("/diary");
  return { ok: true, data: undefined };
}

