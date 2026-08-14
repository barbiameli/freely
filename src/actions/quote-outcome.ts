"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/events";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { createProjectFromBrief } from "@/lib/track-from-brief";
import type { ActionResult } from "@/actions/briefs";

/**
 * Recording whether a quote was won.
 *
 * The columns are newer than the generated Prisma client in this sandbox, so
 * the writes are cast. The build regenerates the client properly, at which
 * point the casts stop doing anything rather than start being wrong.
 */
type BriefPatch = Parameters<typeof prisma.brief.update>[0]["data"];

/**
 * Marks a quote won, and tracks it.
 *
 * One action rather than two, because "we got it" and "start tracking it" are
 * the same moment. Splitting them is what left quotes sitting untracked for
 * weeks: the answer to "did you land this?" was already known, it just had
 * nowhere to go.
 *
 * Tracking is best-effort on top of the outcome. If the project cannot be
 * created, the win is still recorded: losing the answer because the side
 * effect failed would mean asking again about a job already won.
 */
export async function markQuoteWonAction(
  briefId: string
): Promise<ActionResult<{ projectId: string | null }>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
    include: { project: { select: { id: true } } },
  });
  if (!brief) return { ok: false, error: "That quote no longer exists." };

  await prisma.brief.update({
    where: { id: brief.id },
    data: { outcome: "WON", outcomeAt: new Date() } as unknown as BriefPatch,
  });

  let projectId = brief.project?.id ?? null;
  if (!projectId) {
    try {
      projectId = await createProjectFromBrief(brief.id, user.id);
    } catch (err) {
      // Deliberately swallowed: see the note above. The win is the thing that
      // must not be lost, and the freelancer can still track it by hand.
      console.error("[markQuoteWonAction] won, but tracking failed", err);
    }
  }

  revalidatePath("/quote");
  revalidatePath("/track");
  // Won, and the project it became, so tracking can be counted against it.
  track("quote_won", { userId: user.id, subjectId: briefId });
  if (projectId) track("project_tracked", { userId: user.id, subjectId: projectId });

  return { ok: true, data: { projectId } };
}

/** Marks a quote lost. Nothing else happens: the fact is the whole record. */
export async function markQuoteLostAction(briefId: string): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
    select: { id: true },
  });
  if (!brief) return { ok: false, error: "That quote no longer exists." };

  await prisma.brief.update({
    where: { id: brief.id },
    data: { outcome: "LOST", outcomeAt: new Date() } as unknown as BriefPatch,
  });

  revalidatePath("/quote");
  track("quote_lost", { userId: user.id, subjectId: briefId });
  return { ok: true, data: undefined };
}

/**
 * Closes the prompt.
 *
 * Stamps the moment rather than setting a flag, so quotes written afterwards
 * bring it back. Closing something means "not this", not "never again".
 */
export async function dismissQuotePromptAction(): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { quotePromptDismissedAt: new Date() } as unknown as Parameters<
      typeof prisma.user.update
    >[0]["data"],
  });
  revalidatePath("/quote");
  return { ok: true, data: undefined };
}

/** Dismisses the "a client signed this" banner, so it says it once. */
export async function markAcceptanceSeenAction(
  briefId: string
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
    select: { id: true },
  });
  if (!brief) return { ok: false, error: "That quote no longer exists." };

  await prisma.brief.update({
    where: { id: brief.id },
    data: { acceptanceSeenAt: new Date() } as unknown as BriefPatch,
  });
  revalidatePath("/quote");
  return { ok: true, data: undefined };
}
