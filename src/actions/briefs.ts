"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/events";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { createProjectFromBrief } from "@/lib/track-from-brief";
import { reconcileMilestones } from "@/lib/milestones";
import { sanitizeText, stripLongDashes, stripContrastive } from "@/lib/sanitize-text";
import { resolveQuoteLocale } from "@/lib/i18n";
import { enforceLlmRateLimit } from "@/lib/rate-limit";
import {
  generateBriefFromDraft,
  refineBrief,
  shouldResearchMarketRates,
  needsMarketRateNote,
  type GeneratedBrief,
  type QuoteDraftInput,
  type MemoryContext,
  type PricingHistoryEntry,
  type Strategy,
  type BriefExtras,
} from "@/lib/anthropic";
import { getMarketRateNote } from "@/lib/market-rate-cache";

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

/** Cleaning for generated copy: the usual control-character strip, plus
 * flattening the em dashes the model reaches for despite being told not to.
 * Only applied to model output, never to text the user typed. */
function clean(text: string): string {
  return stripLongDashes(sanitizeText(text));
}

/**
 * Cleaning for the prose fields, which additionally drops the "X, not Y" tail.
 *
 * Kept separate from clean() on purpose: terms, payment terms and the revisions
 * policy go through clean() only, because in those a contrast is often the
 * substance of the clause ("due on delivery, not on acceptance") and removing
 * it would change what is being agreed.
 */
function cleanProse(text: string): string {
  return stripContrastive(clean(text));
}

/** Pulls the optional add-on sections off the generated brief into the shape
 * stored in Brief.extras, sanitized. */
function sanitizeExtras(generated: GeneratedBrief): BriefExtras {
  return {
    ...(generated.terms
      ? {
          terms: {
            cancellation: clean(generated.terms.cancellation),
            ownership: clean(generated.terms.ownership),
            confidentiality: clean(generated.terms.confidentiality),
          },
        }
      : {}),
    ...(generated.revisions ? { revisions: clean(generated.revisions) } : {}),
    ...(generated.availability ? { availability: clean(generated.availability) } : {}),
    ...(generated.paymentTerms ? { paymentTerms: clean(generated.paymentTerms) } : {}),
    ...(generated.aiUsage
      ? {
          aiUsage: {
            will: generated.aiUsage.will.map(clean),
            willNot: generated.aiUsage.willNot.map(clean),
          },
        }
      : {}),
  };
}

function hasExtras(generated: GeneratedBrief): boolean {
  return Boolean(
    generated.terms ||
      generated.revisions ||
      generated.availability ||
      generated.paymentTerms ||
      generated.aiUsage
  );
}

/** Postgres rejects NUL bytes inside jsonb just as it does in text columns,
 * so the Strategy object needs the same cleaning as the plain-text fields
 * before it's stored. */
function sanitizeStrategy(strategy: Strategy): Strategy {
  return {
    goal: cleanProse(strategy.goal),
    findings: strategy.findings.map(cleanProse),
    aiWill: strategy.aiWill.map(clean),
    aiWillNot: strategy.aiWillNot.map(clean),
    openQuestions: strategy.openQuestions.map(cleanProse),
  };
}

/**
 * Past quotes, as pricing anchors for a new one.
 *
 * Now carries whether each was won. A quote that was accepted is evidence that
 * the price worked; one that was turned down is evidence it did not, and a
 * pile of both told the model nothing except roughly what this person charges.
 * Won quotes are put first and labelled, so the model anchors on work that
 * actually landed rather than on the average of every number ever typed.
 *
 * Lost ones are kept rather than filtered out, because "this was quoted at
 * this and rejected" is a real signal, and dropping them would leave a
 * freelancer whose recent quotes all lost with no history at all.
 */
async function buildPricingHistory(user: {
  id: string;
  teamId: string | null;
}): Promise<PricingHistoryEntry[]> {
  const past = (await prisma.brief.findMany({
    where: { ...teamScopeWhere(user), price: { gt: 0 }, hours: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: 25,
  })) as unknown as {
    title: string;
    price: number;
    hours: number;
    outcome?: "PENDING" | "WON" | "LOST";
  }[];

  const entries = past.map((p) => ({
    title: p.title,
    price: p.price,
    hours: p.hours,
    impliedHourlyRate: p.price / p.hours,
    outcome: p.outcome ?? "PENDING",
  }));

  // Won first, then undecided, then lost, and cap at 15 so the prompt does not
  // grow without limit. Sorting rather than filtering means a won quote from a
  // year ago still beats a rejected one from last week.
  const rank = { WON: 0, PENDING: 1, LOST: 2 } as const;
  return entries.sort((a, b) => rank[a.outcome] - rank[b.outcome]).slice(0, 15);
}

/** Generates a new brief via Claude and stores it as a DRAFT. */
export async function generateBriefAction(
  draftInput: QuoteDraftPayload
): Promise<ActionResult<{ briefId: string }>> {
  const user = await requireFullUser();

  // The quote's language is a saved preference, not a wizard field, so it is
  // resolved here rather than trusted from the client. Overwriting draft means
  // the prompt and the stored column cannot disagree about it.
  const quoteLanguage = resolveQuoteLocale(user);
  const draft: QuoteDraftPayload = { ...draftInput, language: quoteLanguage };

  if (!draft.sourceText.trim()) {
    return { ok: false, error: "Add some source material before generating a brief." };
  }
  // The rate is optional, but then a market has to be named, because a rate
  // has to come from somewhere and the same job pays very differently from
  // one place to the next.
  const hasRate = Boolean(draft.hourlyRate && draft.hourlyRate > 0);
  const hasMarket = Boolean(
    draft.pricing?.yourLocation?.trim() || draft.pricing?.clientLocation?.trim()
  );
  if (!hasRate && !hasMarket) {
    return {
      ok: false,
      error: "Add your rate, or say where you or the client are based.",
    };
  }

  const pricingHistory = await buildPricingHistory(user);
  const researched = shouldResearchMarketRates(draft, pricingHistory);

  // Where they are based barely changes, so remember it and stop asking.
  const yourLocation = draft.pricing?.yourLocation?.trim();
  if (yourLocation && yourLocation !== (user as unknown as { location?: string }).location) {
    await prisma.user.update({
      where: { id: user.id },
      data: { location: sanitizeText(yourLocation) } as unknown as Parameters<
        typeof prisma.user.update
      >[0]["data"],
    });
  }

  let generated: GeneratedBrief;
  try {
    await enforceLlmRateLimit(user.id);
    // Cache-first (ADR-0001): a market rate researched for another
    // freelancer with the same industry/currency/rateUnit combination is
    // reused here rather than running web_search again.
    const marketRateNote = needsMarketRateNote(draft, pricingHistory)
      ? await getMarketRateNote({
          // Asked of anybody who said they do not know what to charge, and
          // guessed from the currency for everybody else, so the research is
          // always against somewhere rather than against nowhere.
          country: (user as unknown as { country?: string | null }).country ?? null,
          industry: user.industry,
          currency: draft.currency || "USD",
          rateUnit: draft.rateUnit ?? "HOUR",
        })
      : undefined;
    generated = await generateBriefFromDraft(
      await buildMemoryContext(user),
      draft,
      pricingHistory,
      marketRateNote
    );
  } catch (err) {
    console.error("[generateBriefAction] generation failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't generate a brief right now.",
    };
  }

  // Saving is wrapped separately from generation on purpose: by this point
  // the AI call has already succeeded and been paid for, so a failure here
  // (most often a schema/database mismatch after a deploy) should say what
  // actually went wrong rather than surfacing as a generic "try again",
  // which sends people back through another slow generation for nothing.
  let brief;
  try {
    brief = await prisma.brief.create({
      data: {
        userId: user.id,
        // Everything text-shaped gets sanitized on the way in. Extraction
        // already cleans uploaded files, but source text can also be pasted
        // straight in, and the model echoes chunks of it back into these
        // fields, so a single missed NUL anywhere upstream would fail the
        // whole insert after the slow generation had already been paid for.
        title: clean(generated.title),
        client: clean(generated.client),
        scope: cleanProse(generated.scope),
        deliverables: generated.deliverables.map(cleanProse),
        timeline: cleanProse(generated.timeline),
        // Prisma's Json? columns treat an explicit `null` specially (it wants
        // Prisma.JsonNull, not the JS literal) — so when there's no strategy
        // we just omit the field entirely (undefined) and let the column
        // default to NULL, rather than passing null directly.
        ...(generated.strategy ? { strategy: sanitizeStrategy(generated.strategy) } : {}),
        ...(hasExtras(generated) ? { extras: sanitizeExtras(generated) } : {}),
        price: generated.price,
        hours: generated.hours,
        hourlyRate: draft.hourlyRate,
        // The generated client here predates this column; see lib/track-db for
        // the same situation.
        ...({
          rateUnit: draft.rateUnit ?? "HOUR",
          language: quoteLanguage,
        } as Record<string, string>),
        currency: draft.currency || "USD",
        expertiseLevel: draft.expertiseLevel,
        sourceText: sanitizeText(draft.sourceText),
        template: draft.template || "classic",
        branding: draft.branding || "freely",
        settings: {
          instructions: sanitizeText(draft.instructions),
          memoryProjectTitles: draft.memoryProjectTitles.map(sanitizeText),
          format: draft.format,
          includeSOW: draft.includeSOW,
          includeAI: draft.includeAI,
          includeStrategy: draft.includeStrategy,
          includeTimeline: draft.includeTimeline,
          // How this bills, as agreed with the client. Kept on the brief
          // rather than only on the project, because the milestones are part
          // of what the client signed and the project is created from this.
          useMilestones: draft.paymentPlan === "MILESTONE",
          paymentPlan: draft.paymentPlan ?? "SPLIT",
          upfrontPercent: draft.upfrontPercent ?? 50,
          milestones: generated.milestones?.length
            ? reconcileMilestones(
                generated.milestones.map((ms) => ({ ...ms, name: clean(ms.name) })),
                generated.deliverables.length,
                generated.price
              ).map((ms) => ({
                // Spread into a plain object: Prisma's Json input type rejects
                // a declared interface, even a structurally identical one.
                name: ms.name,
                deliverableIndexes: ms.deliverableIndexes,
                // The agreement that closes it, which is what makes the split
                // a dependency boundary rather than an arbitrary cut.
                ...(ms.gate ? { gate: clean(ms.gate) } : {}),
                amount: ms.amount,
              }))
            : undefined,
          includeTerms: draft.includeTerms ?? false,
          includeRevisions: draft.includeRevisions ?? false,
          includeAvailability: draft.includeAvailability ?? false,
          usedPricingResearch: researched,
          // Kept so a quote can be explained later: which market the numbers
          // were researched against.
          pricing: draft.pricing
            ? Object.fromEntries(
                Object.entries(draft.pricing).map(([k, v]) => [k, sanitizeText(String(v ?? ""))])
              )
            : undefined,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Always log the full error server-side: the message returned to the
    // browser is necessarily trimmed, and without this there's nothing to
    // look at in the deployment's runtime logs when something goes wrong.
    console.error("[generateBriefAction] failed to save generated brief", err);
    // Always include the real message rather than guessing at a cause. An
    // earlier version pattern-matched on "column" and confidently blamed a
    // missing database column, which sent us chasing `prisma db push` when
    // the actual problem was a stale generated Prisma Client. A wrong
    // diagnosis stated confidently is worse than no diagnosis.
    return {
      ok: false,
      error: `The quote was generated but couldn't be saved. ${message}`,
    };
  }

  revalidatePath("/quote");
  // Never awaited: a chart is not worth delaying somebody's quote for.
  track("quote_generated", {
    userId: user.id,
    subjectId: brief.id,
    detail: {
      price: generated.price,
      hours: generated.hours,
      currency: draft.currency,
      language: quoteLanguage,
      rateUnit: draft.rateUnit ?? "HOUR",
      researched,
      count: generated.deliverables.length,
    },
  });

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
    await enforceLlmRateLimit(user.id);
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
      title: clean(updated.title),
      client: clean(updated.client),
      scope: clean(updated.scope),
      deliverables: updated.deliverables.map(clean),
      timeline: clean(updated.timeline),
      ...(updated.strategy ? { strategy: sanitizeStrategy(updated.strategy) } : {}),
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
    select: { id: true },
  });
  if (!brief) throw new Error("Brief not found.");

  // The transaction that builds the project lives in lib/track-from-brief now,
  // because answering "we got it" on the quotes list and a client signing the
  // quote both need to do exactly this.
  const projectId = await createProjectFromBrief(brief.id, user.id);

  revalidatePath("/track");
  redirect(`/track/${projectId}`);
}

/**
 * Saves hand-edits to the generated text.
 *
 * Changing one word by re-prompting is slow, costs a generation, and can
 * quietly rewrite the parts you were happy with. Everything client-facing is
 * therefore directly editable, and this is what persists it. Sanitized on the
 * way in like every other write.
 */
export async function updateBriefContentAction(
  briefId: string,
  patch: {
    title?: string;
    client?: string;
    scope?: string;
    deliverables?: string[];
    timeline?: string;
    price?: number;
    hours?: number;
    extras?: BriefExtras;
    strategy?: Strategy;
  }
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
    select: { id: true },
  });
  if (!brief) return { ok: false, error: "Quote not found." };

  if (patch.title !== undefined && !patch.title.trim()) {
    return { ok: false, error: "The quote needs a title." };
  }
  if (patch.price !== undefined && (Number.isNaN(patch.price) || patch.price < 0)) {
    return { ok: false, error: "Price needs to be a number, and not a negative one." };
  }
  if (patch.hours !== undefined && (Number.isNaN(patch.hours) || patch.hours < 0)) {
    return { ok: false, error: "Hours needs to be a number, and not a negative one." };
  }

  try {
    await prisma.brief.update({
      where: { id: brief.id },
      data: {
        ...(patch.title !== undefined ? { title: sanitizeText(patch.title) } : {}),
        ...(patch.client !== undefined ? { client: sanitizeText(patch.client) } : {}),
        ...(patch.scope !== undefined ? { scope: sanitizeText(patch.scope) } : {}),
        ...(patch.deliverables !== undefined
          ? { deliverables: patch.deliverables.map(sanitizeText).filter(Boolean) }
          : {}),
        ...(patch.timeline !== undefined ? { timeline: sanitizeText(patch.timeline) } : {}),
        ...(patch.price !== undefined ? { price: patch.price } : {}),
        ...(patch.hours !== undefined ? { hours: patch.hours } : {}),
        ...(patch.extras !== undefined ? { extras: sanitizeExtrasInput(patch.extras) } : {}),
        ...(patch.strategy !== undefined ? { strategy: sanitizeStrategy(patch.strategy) } : {}),
      },
    });
  } catch (err) {
    console.error("[updateBriefContentAction] failed to save edits", err);
    return {
      ok: false,
      error: `Couldn't save that edit. ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  revalidatePath(`/quote/${briefId}`);
  return { ok: true, data: undefined };
}

/** Same cleaning as generated extras, for user-typed edits. */
function sanitizeExtrasInput(extras: BriefExtras): BriefExtras {
  return {
    ...(extras.terms
      ? {
          terms: {
            cancellation: sanitizeText(extras.terms.cancellation),
            ownership: sanitizeText(extras.terms.ownership),
            confidentiality: sanitizeText(extras.terms.confidentiality),
          },
        }
      : {}),
    ...(extras.revisions !== undefined ? { revisions: sanitizeText(extras.revisions) } : {}),
    ...(extras.availability !== undefined
      ? { availability: sanitizeText(extras.availability) }
      : {}),
    ...(extras.paymentTerms !== undefined
      ? { paymentTerms: sanitizeText(extras.paymentTerms) }
      : {}),
    ...(extras.aiUsage
      ? {
          aiUsage: {
            will: extras.aiUsage.will.map(sanitizeText),
            willNot: extras.aiUsage.willNot.map(sanitizeText),
          },
        }
      : {}),
  };
}

/**
 * Deletes a quote.
 *
 * Only ever a draft: once a quote is in Track there is a project hanging off
 * it, and deleting the quote would take the tracked work with it. Those are
 * deleted from Track instead.
 */
export async function deleteBriefAction(briefId: string): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
    select: { id: true, status: true, project: { select: { id: true } } },
  });
  if (!brief) return { ok: false, error: "That quote no longer exists." };
  if (brief.status === "TRACKED" || brief.project) {
    return {
      ok: false,
      error: "That quote is being tracked as a project. Delete it from Track instead.",
    };
  }

  await prisma.brief.delete({ where: { id: brief.id } });
  revalidatePath("/quote");
  revalidatePath("/quote/all");
  return { ok: true, data: undefined };
}
