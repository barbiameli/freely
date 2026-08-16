"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { markSeen, hintFor, type GuideStep, type GuideState } from "@/lib/guide";
import type { ActionResult } from "@/actions/briefs";

/**
 * What the account has done, counted once for the guide.
 *
 * Counts rather than rows: the guide only ever asks whether a number is zero,
 * and loading the quotes themselves to find that out would put a real query on
 * every page load in exchange for nothing.
 */
export async function guideStateFor(userId: string): Promise<GuideState | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const scope = teamScopeWhere(user);

  const [quotes, publishedQuotes, acceptedQuotes, projects, brokenDown, diaryEntries, invoices] =
    await Promise.all([
      prisma.brief.count({ where: scope }),
      prisma.brief.count({ where: { ...scope, published: true } }),
      prisma.brief.count({ where: { ...scope, status: "TRACKED" } }),
      prisma.project.count({ where: scope }),
      prisma.deliverable.count({
        where: { project: scope, brokenDownAt: { not: null } },
      } as unknown as { where: Record<string, unknown> }),
      prisma.diaryEntry.count({ where: { project: scope } }),
      prisma.invoice.count({ where: scope }),
    ]);

  return {
    quotes,
    publishedQuotes,
    acceptedQuotes,
    projects,
    brokenDownDeliverables: brokenDown,
    diaryEntries,
    invoices,
    seen: ((user as unknown as { guideSeen?: string[] }).guideSeen ?? []) as GuideStep[],
  };
}

/** The hint for a screen, or null. Called from the page that might show one. */
export async function hintForScreen(screen: string): Promise<GuideStep | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const state = await guideStateFor(user.id);
  return state ? hintFor(screen, state) : null;
}

/**
 * Records that a hint has been seen.
 *
 * Never fails loudly. The worst outcome of this not saving is one repeated
 * hint, and returning an error for it would put an error message on screen in
 * place of a hint somebody just closed.
 */
export async function dismissGuideStepAction(step: GuideStep): Promise<ActionResult<undefined>> {
  try {
    const sessionUser = await requireUser();
    const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!user) return { ok: true, data: undefined };

    const seen = ((user as unknown as { guideSeen?: string[] }).guideSeen ?? []) as GuideStep[];
    await prisma.user.update({
      where: { id: sessionUser.id },
      data: { guideSeen: markSeen(seen, step) } as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error("[dismissGuideStepAction] failed", err);
  }
  return { ok: true, data: undefined };
}
