"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import type { ActionResult } from "@/actions/briefs";
import { plainDeliverableNames } from "@/lib/anthropic";

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


/**
 * Which register the client's page is written in.
 *
 * Turning it on writes the plain-language names for anything that has not got
 * one yet, and leaves anything that has alone: a name somebody corrected must
 * survive being toggled off and on again, which is the whole reason the plain
 * version is stored rather than generated on each render.
 *
 * Turning it off writes nothing and deletes nothing. The plain names stay,
 * because switching back should be instant and free.
 */
export async function setPlainLanguageAction(
  projectId: string,
  on: boolean
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
    include: { deliverables: { orderBy: { order: "asc" } }, brief: true },
  });
  if (!project) return { ok: false, error: "Project not found." };

  if (on) {
    const missing = project.deliverables.filter(
      (d) => !(d as unknown as { clientName?: string | null }).clientName
    );
    if (missing.length > 0) {
      try {
        // The client's language, which is the quote's language rather than the
        // interface's: a Spanish freelancer often has English clients.
        const language =
          ((project.brief as unknown as { language?: string } | null)?.language as
            | "en"
            | "es") ?? "en";
        const plain = await plainDeliverableNames(
          missing.map((d) => d.name),
          language
        );
        await Promise.all(
          missing.map((d, i) =>
            prisma.deliverable.update({
              where: { id: d.id },
              data: { ...({ clientName: plain[i] } as Record<string, unknown>) },
            })
          )
        );
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error ? err.message : "Couldn't rewrite those in plain language.",
        };
      }
    }
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { ...({ plainLanguage: on } as Record<string, unknown>) },
  });

  revalidatePath(`/diary/${projectId}`);
  revalidatePath(`/track/${projectId}`);
  return { ok: true, data: undefined };
}

/** Corrects one plain-language name by hand. It is what the client reads, so
 * it has to be editable without regenerating the rest. */
export async function updateClientNameAction(
  deliverableId: string,
  clientName: string
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const deliverable = await prisma.deliverable.findFirst({
    where: { id: deliverableId, project: teamScopeWhere(user) },
    include: { project: true },
  });
  if (!deliverable) return { ok: false, error: "Not found." };

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { ...({ clientName: clientName.trim() || null } as Record<string, unknown>) },
  });
  revalidatePath(`/diary/${deliverable.projectId}`);
  return { ok: true, data: undefined };
}
