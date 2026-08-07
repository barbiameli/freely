"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import {
  generateBriefFromDraft,
  refineBrief,
  type GeneratedBrief,
  type QuoteDraftInput,
  type MemoryContext,
  type PricingHistoryEntry,
  type Strategy,
} from "@/lib/anthropic";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Assembles everything saved in Memory (Instructions, Tone, Story, Context,
 * Files) into the shape the Claude integration expects. */
async function buildMemoryContext(user: {
  id: string;
  memoryInstructions: string;
  toneNotes: string;
  storyNotes: string;
  contextNotes: string;
}): Promise<MemoryContext> {
  const files = await prisma.memoryAsset.findMany({
    where: { userId: user.id, type: "FILE" },
    select: { name: true, textContent: true },
  });
  return {
    instructions: user.memoryInstructions,
    toneNotes: user.toneNotes,
    storyNotes: user.storyNotes,
    contextNotes: user.contextNotes,
    fileExcerpts: files
      .filter((f) => f.textContent)
      .map((f) => ({ name: f.name, text: f.textContent as string })),
  };
}

// File text extraction (for both this wizard's source step and Memory's
// Files tab) lives at POST /api/extract-text — a real Route Handler, not a
// server action, because pdf-parse's native dependencies don't survive
// Next's server-action bundler. See src/app/api/extract-text/route.ts.

export type QuoteDraftPayload = QuoteDraftInput;

/** Pulls this freelancer's own past quotes (team-scoped) as pricing anchors
 * for a new quote — Claude uses these to reason about hours/price instead of
 * guessing. Only briefs with a real price and hours logged count. */
async function buildPricingHistory(user: {
  id: string;
  teamId: string | null;
}): Promise<PricingHistoryEntry[]> {
  const past = await prisma.brief.findMany({
    where: { ...teamScopeWhere(user), price: { gt: 0 }, hours: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    select: { title: true, price: true, hours: true },
    take: 15,
  });
  return past.map((p) => ({
    title: p.title,
    price: p.price,
    hours: p.hours,
    impliedHourlyRate: p.price / p.hours,
  }));
}

/** Generates a new brief via Claude and stores it as a DRAFT. */
export async function generateBriefAction(
  draft: QuoteDraftPayload
): Promise<ActionResult<{ briefId: string }>> {
  const user = await requireFullUser();

  if (!draft.sourceText.trim()) {
    return { ok: false, error: "Add some source material before generating a brief." };
  }
  if (!draft.hourlyRate || draft.hourlyRate <= 0) {
    return { ok: false, error: "Add your hourly rate before generating a brief." };
  }

  const pricingHistory = await buildPricingHistory(user);

  let generated: GeneratedBrief;
  try {
    generated = await generateBriefFromDraft(await buildMemoryContext(user), draft, pricingHistory);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't generate a brief right now.",
    };
  }

  const brief = await prisma.brief.create({
    data: {
      userId: user.id,
      title: generated.title,
      client: generated.client,
      scope: generated.scope,
      deliverables: generated.deliverables,
      timeline: generated.timeline,
      // Prisma's Json? columns treat an explicit `null` specially (it wants
      // Prisma.JsonNull, not the JS literal) — so when there's no strategy we
      // just omit the field entirely (undefined) and let the column default
      // to NULL, rather than passing null directly.
      ...(generated.strategy ? { strategy: generated.strategy } : {}),
      price: generated.price,
      hours: generated.hours,
      hourlyRate: draft.hourlyRate,
      currency: draft.currency || "USD",
      expertiseLevel: draft.expertiseLevel,
      sourceText: draft.sourceText,
      template: draft.template || "classic",
      branding: draft.branding || "freely",
      settings: {
        instructions: draft.instructions,
        memoryProjectTitles: draft.memoryProjectTitles,
        detailLevel: draft.detailLevel,
        format: draft.format,
        includeSOW: draft.includeSOW,
        includeAI: draft.includeAI,
        includeStrategy: draft.includeStrategy,
        includeTimeline: draft.includeTimeline,
        usedPricingResearch: pricingHistory.length === 0,
      },
    },
  });

  revalidatePath("/quote");
  return { ok: true, data: { briefId: brief.id } };
}

/** Refines an existing brief with a follow-up instruction. */
export async function refineBriefAction(
  briefId: string,
  refinePrompt: string
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
  });
  if (!brief) return { ok: false, error: "Brief not found." };
  if (!refinePrompt.trim()) return { ok: false, error: "Add a refinement instruction." };

  const current: GeneratedBrief = {
    title: brief.title,
    client: brief.client,
    scope: brief.scope,
    deliverables: brief.deliverables as string[],
    timeline: brief.timeline,
    strategy: (brief.strategy as Strategy | null) ?? undefined,
    price: brief.price,
    hours: brief.hours,
  };

  let updated: GeneratedBrief;
  try {
    updated = await refineBrief(await buildMemoryContext(user), current, refinePrompt);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't refine that brief.",
    };
  }

  await prisma.brief.update({
    where: { id: brief.id },
    data: {
      title: updated.title,
      client: updated.client,
      scope: updated.scope,
      deliverables: updated.deliverables,
      timeline: updated.timeline,
      ...(updated.strategy ? { strategy: updated.strategy } : {}),
      price: updated.price,
      hours: updated.hours,
    },
  });

  revalidatePath(`/quote/${briefId}`);
  return { ok: true, data: undefined };
}

/** Publishes/unpublishes a brief as a real, shareable "HTML page" quote at
 * /q/[publicSlug] — no login required. This is what the wizard's "HTML page"
 * format option actually produces; previously it was just a stored
 * preference with no page behind it. */
export async function setBriefPublishedAction(
  briefId: string,
  published: boolean
): Promise<ActionResult<{ publicSlug: string }>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
  });
  if (!brief) return { ok: false, error: "Brief not found." };

  const updated = await prisma.brief.update({ where: { id: briefId }, data: { published } });
  revalidatePath(`/quote/${briefId}`);
  return { ok: true, data: { publicSlug: updated.publicSlug } };
}

/** Attaches a reference file (screenshot, moodboard, past landing page...) to
 * a brief with a caption explaining how it applies — e.g. "this is a landing
 * page I built — I'd apply a similar structure here." Stored as a data URL,
 * same pattern as Memory's file/image assets. */
export async function addBriefExampleAction(
  briefId: string,
  name: string,
  dataUrl: string,
  caption: string
): Promise<ActionResult<{ id: string }>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
  });
  if (!brief) return { ok: false, error: "Brief not found." };
  if (!dataUrl) return { ok: false, error: "Add a file first." };

  const count = await prisma.briefExample.count({ where: { briefId } });
  const example = await prisma.briefExample.create({
    data: { briefId, name, dataUrl, caption, order: count },
  });

  revalidatePath(`/quote/${briefId}`);
  return { ok: true, data: { id: example.id } };
}

/** Updates an example's explanatory caption (or its name). */
export async function updateBriefExampleAction(
  exampleId: string,
  fields: { name?: string; caption?: string }
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const example = await prisma.briefExample.findFirst({
    where: { id: exampleId, brief: teamScopeWhere(user) },
  });
  if (!example) return { ok: false, error: "Example not found." };

  await prisma.briefExample.update({ where: { id: exampleId }, data: fields });
  revalidatePath(`/quote/${example.briefId}`);
  return { ok: true, data: undefined };
}

/** Removes an example from a brief. */
export async function deleteBriefExampleAction(
  exampleId: string
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const example = await prisma.briefExample.findFirst({
    where: { id: exampleId, brief: teamScopeWhere(user) },
  });
  if (!example) return { ok: false, error: "Example not found." };

  await prisma.briefExample.delete({ where: { id: exampleId } });
  revalidatePath(`/quote/${example.briefId}`);
  return { ok: true, data: undefined };
}

/** Converts an accepted brief into a tracked Project, then redirects there. */
export async function addBriefToTrackAction(briefId: string) {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
  });
  if (!brief) throw new Error("Brief not found.");

  const deliverables = (brief.deliverables as string[]).map((name, order) => ({ name, order }));

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        userId: user.id,
        briefId: brief.id,
        title: brief.title,
        client: brief.client,
        price: brief.price,
        hours: brief.hours,
        timeline: brief.timeline,
        currency: brief.currency,
        deliverables: { create: deliverables },
      },
    });
    await tx.diaryEntry.create({
      data: {
        projectId: created.id,
        title: "Project kicked off",
        body: `Kicking off ${brief.title}, excited to get started. Here's what's ahead: ${
          brief.timeline || "a few focused weeks of work"
        }.`,
        autoGenerated: true,
      },
    });
    await tx.brief.update({ where: { id: brief.id }, data: { status: "TRACKED" } });
    return created;
  });

  revalidatePath("/track");
  redirect(`/track/${project.id}`);
}
