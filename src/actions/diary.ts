"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import type { ActionResult } from "@/actions/briefs";

export async function addDiaryEntryAction(
  projectId: string,
  title: string,
  body: string
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
  });
  if (!project) return { ok: false, error: "Project not found." };
  if (!body.trim()) return { ok: false, error: "Write something before adding an entry." };

  await prisma.diaryEntry.create({
    data: { projectId, title: title.trim() || "Update", body: body.trim() },
  });

  revalidatePath(`/diary/${projectId}`);
  return { ok: true, data: undefined };
}

export async function updateDiaryEntryAction(
  entryId: string,
  patch: { title?: string; body?: string }
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const entry = await prisma.diaryEntry.findFirst({
    where: { id: entryId, project: teamScopeWhere(user) },
    include: { project: true },
  });
  if (!entry) return { ok: false, error: "Entry not found." };

  await prisma.diaryEntry.update({ where: { id: entryId }, data: patch });
  revalidatePath(`/diary/${entry.projectId}`);
  return { ok: true, data: undefined };
}

export async function setPublishedAction(
  projectId: string,
  published: boolean
): Promise<ActionResult<{ publicSlug: string }>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const updated = await prisma.project.update({ where: { id: projectId }, data: { published } });
  revalidatePath(`/diary/${projectId}`);
  return { ok: true, data: { publicSlug: updated.publicSlug } };
}
