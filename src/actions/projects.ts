"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { done: !deliverable.done },
  });

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

  await prisma.project.delete({ where: { id: projectId } });

  revalidatePath("/track");
  revalidatePath("/diary");
  return { ok: true, data: undefined };
}

/** Sends a snapshot of current project state to the Diary as an auto-generated entry. */
export async function sendToDiaryAction(projectId: string): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
    include: { deliverables: true },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const done = project.deliverables.filter((d) => d.done).length;
  await prisma.diaryEntry.create({
    data: {
      projectId,
      title: "Update from Track",
      body: `${done} of ${project.deliverables.length} deliverables complete so far. Status: ${project.status}.`,
      autoGenerated: true,
    },
  });

  revalidatePath(`/diary/${projectId}`);
  return { ok: true, data: undefined };
}
