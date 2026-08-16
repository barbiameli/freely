"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/events";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import type { ActionResult } from "@/actions/briefs";
import { plainDeliverableNames } from "@/lib/anthropic";


/**
 * Revalidates the client's page as well as the freelancer's.
 *
 * Everything in this file changes what a client reads, and revalidating only
 * /diary means the tool looks updated while the page they were sent does not.
 * The public route is force-dynamic today, so this is belt and braces rather
 * than load-bearing, and it is exactly the sort of thing that stops being belt
 * and braces the moment somebody adds caching.
 */
async function revalidateBoth(projectId: string): Promise<void> {
  revalidatePath(`/track/${projectId}`);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { publicSlug: true },
  });
  if (project?.publicSlug) revalidatePath(`/p/${project.publicSlug}`);
}

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

  // The same update, twice, within a few minutes is a double submit rather than
  // two things that happened. Three identical entries appeared on a real project
  // this way, and the client's page showed all three. Cheap to prevent here and
  // impossible to tidy up afterwards without a delete button.
  const duplicate = await prisma.diaryEntry.findFirst({
    where: {
      projectId,
      body: body.trim(),
      createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });
  if (duplicate) return { ok: true, data: undefined };

  await prisma.diaryEntry.create({
    data: { projectId, title: title.trim() || "Update", body: body.trim() },
  });
  track("diary_entry_added", { userId: user.id, subjectId: projectId });

  await revalidateBoth(projectId);
  return { ok: true, data: undefined };
}

/**
 * Removing an entry.
 *
 * Needed because everything else here can go wrong in public. A duplicate, a
 * line written in tracker shorthand, an update sent to the wrong project: all
 * of them are on the client's page until this exists.
 */
export async function deleteDiaryEntryAction(
  entryId: string
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const entry = await prisma.diaryEntry.findFirst({
    where: { id: entryId, project: teamScopeWhere(user) },
  });
  if (!entry) return { ok: false, error: "That entry no longer exists." };

  await prisma.diaryEntry.delete({ where: { id: entryId } });
  await revalidateBoth(entry.projectId);
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
  await revalidateBoth(entry.projectId);
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
  if (published) track("diary_published", { userId: user.id, subjectId: projectId });
  revalidatePath(`/track/${projectId}`);
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

  await revalidateBoth(projectId);
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
  await revalidateBoth(deliverable.projectId);
  return { ok: true, data: undefined };
}
