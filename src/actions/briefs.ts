"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { track } from "@/lib/events";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { createProjectFromBrief } from "@/lib/track-from-brief";
import { reconcileMilestones } from "@/lib/milestones";
import { sanitizeText, stripLongDashes, stripContrastive } from "@/lib/sanitize-text";
import { resolveQuoteLocale, parseLocale } from "@/lib/i18n";
import { enforceLlmRateLimit, RateLimitError } from "@/lib/rate-limit";
import {
  generateQuoteCore,
  generateQuoteExtras,
  refineBrief,
  shouldResearchMarketRates,
  needsMarketRateNote,
  wantsExtras,
  type GeneratedBrief,
  type QuoteDraftInput,
  type MemoryContext,
  type PricingHistoryEntry,
  type Strategy,
  type BriefExtras,
} from "@/lib/anthropic";
import { getMarketRateNote } from "@/lib/market-rate-cache";
import { CURRENT_LAYOUT } from "@/lib/quote-layout";
import { hasStrategyContent } from "@/lib/strategy";
import { allDisciplines, disciplineLine, industryLabel } from "@/lib/industries";
import { withRate } from "@/lib/discipline-rates";
import { isProtectionLevel } from "@/lib/protection";
import { clientFor } from "@/lib/client-db";
import { ruleFix } from "@/lib/rule-words";
import {
  brokenRules,
  blockingRules,
  parseRuleSettings,
  ruleValues,
  ruleOf,
  GROUND_RULES,
} from "@/lib/ground-rules";
import { billingFromSettings } from "@/lib/quote-definitions";
import { milestonesFromSettings } from "@/lib/milestone-lines";
import type { RateUnit } from "@/lib/rate-unit";

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
  industry?: string | null;
  otherIndustries?: string[] | null;
}): Promise<MemoryContext> {
  const files = await prisma.memoryAsset.findMany({
    where: { userId: user.id, type: "FILE" },
    select: { name: true, textContent: true },
  });
  return {
    // What they do, and what else they do. See lib/industries.
    disciplines: disciplineLine(user.industry, user.otherIndustries),
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

/**
 * Keeps the milestone amounts adding up to the price after the quote changes.
 *
 * A refine that brings the total down, or an edit that adds a deliverable,
 * used to leave the milestones exactly as they were: three amounts that summed
 * to the old price, and a deliverable that no milestone covered. The client
 * page then showed a schedule that did not add up to the total on the same
 * page, which is the kind of arithmetic a client checks.
 *
 * Nothing happens to a quote that is not billed this way, and nothing happens
 * when neither the price nor the deliverables moved.
 */
function rebalancedSettings(
  settings: Record<string, unknown>,
  deliverableCount: number,
  totalPrice: number
): Record<string, unknown> {
  if (!settings.useMilestones) return settings;
  const current = Array.isArray(settings.milestones)
    ? (settings.milestones as { name: string; deliverableIndexes: number[]; gate?: string; amount: number }[])
    : [];
  if (current.length === 0) return settings;
  return {
    ...settings,
    milestones: reconcileMilestones(current, deliverableCount, totalPrice).map((ms) => ({
      name: ms.name,
      deliverableIndexes: ms.deliverableIndexes,
      ...(ms.gate ? { gate: ms.gate } : {}),
      amount: ms.amount,
    })),
  };
}

/**
 * Which sections a generated quote actually came back with.
 *
 * Named the same way the removal list names them, so the two can be compared.
 * A refine that writes a section which had been taken out is a refine that was
 * asked to bring it back, and leaving it hidden would mean paying for a
 * paragraph nobody would ever see.
 */
function returnedSections(generated: GeneratedBrief): string[] {
  const present: string[] = [];
  if (hasStrategyContent(generated.strategy)) present.push("strategy");
  if (generated.timeline.trim()) present.push("timeline");
  if (generated.paymentTerms) present.push("paymentTerms");
  if (generated.revisions) present.push("revisions");
  if (generated.availability) present.push("availability");
  if (generated.aiUsage) present.push("aiUsage");
  if (generated.terms) present.push("terms");
  return present;
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
    ...(generated.assumptions?.length
      ? { assumptions: generated.assumptions.map(clean).filter(Boolean) }
      : {}),
    ...(generated.scopeChanges?.length
      ? { scopeChanges: generated.scopeChanges.map(clean).filter(Boolean) }
      : {}),
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
      generated.assumptions?.length ||
      generated.scopeChanges?.length ||
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
    settings?: { discipline?: string } | null;
  }[];

  const entries = past.map((p) => ({
    title: p.title,
    price: p.price,
    hours: p.hours,
    impliedHourlyRate: p.price / p.hours,
    outcome: p.outcome ?? "PENDING",
    // Quotes written before this existed have none, and the prompt says so by
    // omitting the tag rather than by guessing one.
    discipline: p.settings?.discipline,
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

  /**
   * Nothing ticked means the model decides, rather than a bare quote.
   *
   * Sections are all off until chosen, and a first quote from somebody who
   * skipped the list would otherwise be scope, price and nothing else. What
   * comes back is written into settings below, so the quote's sections are
   * as settled afterwards as if they had been picked by hand.
   */
  const chooseSections =
    !draftInput.includeStrategy &&
    !draftInput.includeTimeline &&
    !draftInput.includeSOW &&
    !draftInput.includeTerms &&
    !draftInput.includeRevisions &&
    !draftInput.includeAvailability &&
    !draftInput.includeAssumptions &&
    !draftInput.includeScopeChanges &&
    !draftInput.includeAI;

  const disciplines = allDisciplines(
    user.industry,
    (user as unknown as { otherIndustries?: string[] }).otherIndustries
  ).map((key) => ({ key, label: industryLabel(key) }));

  // The rules this account keeps, so the quote is written to satisfy them.
  const ruleSettings = parseRuleSettings(
    (user as unknown as { groundRules?: unknown }).groundRules
  );
  const activeRules = GROUND_RULES.filter(
    (rule) => rule.checkable && !ruleSettings.off.includes(rule.key)
  ).map((rule) => rule.key);

  const draft: QuoteDraftPayload = {
    ...draftInput,
    language: quoteLanguage,
    activeRules,
    ruleValues: ruleValues(ruleSettings),
    chooseSections,
    // Only when there is a choice. One discipline is a fact, not a question.
    ...(disciplines.length > 1 ? { disciplines } : {}),
  };
  // Whether there is a second half at all. A bare quote is one call and has
  // nothing to wait for.
  const extrasWanted = wantsExtras(draft);

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

  // The rate they used, remembered against the work it was for.
  //
  // Without this, somebody who quotes a marketing job at 55 and a design job
  // at 85 retypes both numbers every time, and the account learns nothing from
  // the fact that they already answered. Written on every quote rather than
  // only the first, because a rate per discipline is a thing people revise,
  // and the last one they actually sent is the best guess at the next one.
  const quotedDiscipline = draft.discipline?.trim();
  if (quotedDiscipline && hasRate) {
    const mine = allDisciplines(
      user.industry,
      (user as unknown as { otherIndustries?: string[] }).otherIndustries
    );
    if (mine.includes(quotedDiscipline)) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ratesByDiscipline: withRate(
            (user as unknown as { ratesByDiscipline?: unknown }).ratesByDiscipline,
            quotedDiscipline,
            { rate: draft.hourlyRate, unit: (draft.rateUnit ?? "HOUR") as RateUnit }
          ) as unknown as Prisma.InputJsonValue,
        } as unknown as Parameters<typeof prisma.user.update>[0]["data"],
      });
    }
  }

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

  let clientId: string | null = null;

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
    // The core only. The add-on sections are written after this returns, from
    // the quote's own page, so the wait ends when there is something to look
    // at rather than when the last paragraph of the terms is finished.
    generated = await generateQuoteCore(
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

  /**
   * Which sections this quote ended up with.
   *
   * When they were ticked, this is just what was ticked. When the model chose,
   * it is read back off what it actually wrote, because from here on the
   * quote's sections are whatever is in the document: the PDF, the public page
   * and the signing offer all read these flags, and a flag that disagrees with
   * the content would show a heading with nothing under it.
   */
  const chosenSections = chooseSections
    ? {
        includeStrategy: hasStrategyContent(generated.strategy),
        // Staged, one line per stage, is what makes Timeline its own section.
        // A single summary sentence is the fallback shape and not a section.
        includeTimeline: generated.timeline.includes("\n"),
        includeSOW: Boolean(generated.paymentTerms),
        includeTerms: Boolean(generated.terms),
        includeRevisions: Boolean(generated.revisions),
        includeAvailability: Boolean(generated.availability),
        includeAssumptions: (generated.assumptions?.length ?? 0) > 0,
        includeScopeChanges: (generated.scopeChanges?.length ?? 0) > 0,
        includeAI: Boolean(generated.aiUsage),
      }
    : {
        includeStrategy: draft.includeStrategy,
        includeTimeline: draft.includeTimeline,
        includeSOW: draft.includeSOW,
        includeTerms: draft.includeTerms ?? false,
        includeRevisions: draft.includeRevisions ?? false,
        includeAvailability: draft.includeAvailability ?? false,
        includeAssumptions: draft.includeAssumptions ?? false,
        includeScopeChanges: draft.includeScopeChanges ?? false,
        includeAI: draft.includeAI,
      };

  // The client record, from the name the quote ended up with. Never fatal: a
  // quote that generated fine must not fail to save because a lookup did.
  try {
    /**
     * The name they typed beats the one the model wrote.
     *
     * Type "Beyond Data", let the model return "Beyond Data Ltd", and the next
     * quote returns "Beyond Data" again: two client records for one client,
     * with the history that drives the protection level split across both.
     * Invisible, and it corrupts the thing the record exists for.
     */
    clientId = await clientFor(user.id, draftInput.clientName?.trim() || generated.client);
  } catch (err) {
    console.error("[generateBriefAction] could not resolve client", err);
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
        // Joined up with everything else of theirs. Created as a side effect
        // of work somebody was doing anyway, since a client list maintained
        // by hand is admin, and admin is the first thing to be abandoned.
        ...(clientId ? { clientId } : {}),
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
          // Pinned here and never rewritten. See lib/quote-layout: a quote a
          // client has already been sent must not change shape underneath them
          // because the app moved on.
          layout: CURRENT_LAYOUT,
          // Stages, and whether they are where money moves. Two questions, and
          // they used to be one: a project can run in stages and still be paid
          // in two lumps at either end.
          milestonesBillable:
            draft.milestonesBillable ?? draft.paymentPlan === "MILESTONE",
          // Why this quote carries what it carries. See lib/protection.
          ...(isProtectionLevel(draftInput.protection)
            ? { protection: draftInput.protection }
            : {}),
          // Whether the total is the price or an estimate. Stored on the quote
          // rather than read off the account, because it is a decision about
          // this job and a freelancer works both ways.
          billing: draft.billing === "HOURLY_TRACKED" ? "HOURLY_TRACKED" : "FIXED_TOTAL",
          // Which kind of work this turned out to be, as named by the model
          // from the freelancer's own list. Read back by the next quote's
          // pricing history, and shown on the quote page where it can be
          // corrected. Only stored when it is one of theirs.
          ...(generated.discipline &&
          disciplines.some((option) => option.key === generated.discipline)
            ? { discipline: generated.discipline }
            : {}),
          // The second half has not been written yet. The quote page reads
          // this, asks for it, and clears the flag. Stored rather than
          // inferred, because "no terms" and "terms not written yet" look
          // identical from the outside and mean opposite things.
          extrasPending: extrasWanted,
          // Everything the second call needs to write the same quote this one
          // started. Without these the add-on sections would be written from
          // the brief alone and the freelancer's own words about their terms,
          // revisions and AI use would be dropped between the two halves.
          chooseSections,
          sectionNotes: draft.sectionNotes ?? {},
          availability: draft.availability ?? { facts: [] },
          instructions: sanitizeText(draft.instructions),
          memoryProjectTitles: draft.memoryProjectTitles.map(sanitizeText),
          format: draft.format,
          ...chosenSections,
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
/**
 * What a refine actually changed, by section.
 *
 * Compared field by field on the way through rather than worked out on the
 * page, because the page only ever sees the new version: after a refresh there
 * is nothing left to compare it against. The keys match the ones the quote
 * page marks its sections with.
 */
function changedSections(before: GeneratedBrief, after: GeneratedBrief): string[] {
  const changed: string[] = [];
  const differs = (a: unknown, b: unknown) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);

  if (differs(before.title, after.title) || differs(before.client, after.client)) {
    changed.push("overview");
  }
  if (differs(before.price, after.price) || differs(before.hours, after.hours)) {
    if (!changed.includes("overview")) changed.push("overview");
  }
  if (differs(before.strategy, after.strategy)) changed.push("strategy");
  if (differs(before.scope, after.scope)) changed.push("scope");
  if (differs(before.deliverables, after.deliverables)) changed.push("deliverables");
  if (differs(before.timeline, after.timeline)) changed.push("timeline");
  if (differs(before.paymentTerms, after.paymentTerms)) changed.push("paymentTerms");
  if (differs(before.revisions, after.revisions)) changed.push("revisions");
  if (differs(before.availability, after.availability)) changed.push("availability");
  if (differs(before.aiUsage, after.aiUsage)) changed.push("aiUsage");
  if (differs(before.terms, after.terms)) changed.push("terms");
  return changed;
}

export async function refineBriefAction(
  briefId: string,
  refinePrompt: string
): Promise<ActionResult<{ changed: string[] }>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
  });
  if (!brief) return { ok: false, error: "Brief not found." };
  if (!refinePrompt.trim()) return { ok: false, error: "Add a refinement instruction." };

  // Everything, including the add-on sections. Sending the quote without them
  // meant an instruction about payment terms or revisions reached a model that
  // could not see either, so it changed something else and the real ones were
  // left exactly as they were.
  const currentExtras = (brief.extras as BriefExtras | null) ?? undefined;
  const current: GeneratedBrief = {
    title: brief.title,
    client: brief.client,
    scope: brief.scope,
    deliverables: brief.deliverables as string[],
    timeline: brief.timeline,
    strategy: (brief.strategy as Strategy | null) ?? undefined,
    price: brief.price,
    hours: brief.hours,
    ...currentExtras,
  };

  const settings = (brief.settings as Record<string, unknown> | null) ?? {};
  const removed = (brief as unknown as { hiddenSections?: string[] }).hiddenSections ?? [];

  let updated: GeneratedBrief;
  try {
    await enforceLlmRateLimit(user.id);
    updated = await refineBrief(await buildMemoryContext(user), current, refinePrompt, {
      language: parseLocale((brief as unknown as { language?: string }).language),
      paymentTerms: currentExtras?.paymentTerms,
      currency: brief.currency ?? undefined,
      rateUnit: ((brief as unknown as { rateUnit?: string }).rateUnit ?? "HOUR") as
        | "HOUR"
        | "DAY"
        | "FIXED",
      hourlyRate: brief.hourlyRate,
      removedSections: removed,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't refine that brief.",
    };
  }

  // Worked out before the write, because the write is what makes the two equal.
  const changed = changedSections(current, updated);

  await prisma.brief.update({
    where: { id: brief.id },
    data: {
      title: clean(updated.title),
      client: clean(updated.client),
      scope: clean(updated.scope),
      deliverables: updated.deliverables.map(clean),
      timeline: clean(updated.timeline),
      ...(updated.strategy ? { strategy: sanitizeStrategy(updated.strategy) } : {}),
      // Written back whole, so a section can be added, rewritten or dropped.
      //
      // Merging over the old set was the safe first move and is the wrong one
      // once a refine is allowed to remove a section: "take out the AI
      // disclosure" would come back without it and the merge would put it
      // straight back. What comes back is the quote now.
      //
      // The exception is a reply that carries no sections at all against a
      // quote that had several, which is a truncated or lazy answer rather
      // than a request to strip the document, so the old set is kept.
      // Empty is a real answer: a refine asked to take out the only section a
      // quote had comes back with none. A reply that was cut short never gets
      // this far, since a truncated response fails to parse and is retried.
      extras: hasExtras(updated) ? sanitizeExtras(updated) : Prisma.JsonNull,
      // The stored section flags follow the document, so the PDF, the public
      // page and the signing offer cannot disagree with what is in it.
      settings: {
        ...rebalancedSettings(settings, updated.deliverables.length, updated.price),
        includeStrategy: hasStrategyContent(updated.strategy),
        includeTimeline: updated.timeline.includes("\n"),
        includeSOW: Boolean(updated.paymentTerms),
        includeTerms: Boolean(updated.terms),
        includeRevisions: Boolean(updated.revisions),
        includeAvailability: Boolean(updated.availability),
        includeAI: Boolean(updated.aiUsage),
      } as unknown as Prisma.InputJsonValue,
      // A removed section comes back only when this refine actually rewrote it.
      //
      // It used to come back whenever the section was present in the reply,
      // which is almost always: the quote is returned whole, so a section
      // somebody had taken out was still in the text being sent back and forth.
      // Removing the timeline and then asking for a shorter scope put the
      // timeline back on the client's page.
      ...(removed.length
        ? ({
            hiddenSections: removed.filter(
              (key) => !(changed.includes(key) && returnedSections(updated).includes(key))
            ),
          } as unknown as Record<string, unknown>)
        : {}),
      price: updated.price,
      hours: updated.hours,
    },
  });

  revalidatePath(`/quote/${briefId}`);
  // Named on the way out, so the page can say what moved and take you to it.
  // A spinner that stops is not feedback: it says something finished, not what
  // it did, and on a long quote the changed paragraph is often off-screen.
  return { ok: true, data: { changed } };
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

  // A quote whose second half is still being written is a quote missing its
  // terms and its payment sentence. Publishing puts it at a URL a client can
  // open, and the sections landing a few seconds later would change a document
  // somebody may already be reading. Unpublishing is always allowed.
  const settings = (brief.settings as { extrasPending?: boolean } | null) ?? {};
  if (published && settings.extrasPending) {
    return {
      ok: false,
      error: "Still writing the rest of this quote. Publishing will work in a moment.",
    };
  }

  // The blocking ground rules, checked on the server as well as in the page.
  //
  // Three of them, and each one is a thing a client has actually written back
  // to ask. They are not a judgement about the quote: every one can be waved
  // through by saying it was deliberate, and that is recorded rather than
  // argued with. What they stop is publishing by accident.
  if (published) {
    const rules = parseRuleSettings((user as unknown as { groundRules?: unknown }).groundRules);
    const acknowledged = new Set(
      ((brief.settings as { rulesAcknowledged?: unknown } | null)?.rulesAcknowledged as
        | string[]
        | undefined) ?? []
    );
    const outstanding = blockingRules(
      brokenRules(
        {
          extras: brief.extras as BriefExtras | null,
          hours: brief.hours ?? 0,
          price: brief.price ?? 0,
          rateUnit: (brief as unknown as { rateUnit?: string }).rateUnit ?? "HOUR",
          billing: billingFromSettings(brief.settings),
          milestoneCount: milestonesFromSettings(brief.settings).length,
          hidden: (brief as unknown as { hiddenSections?: string[] }).hiddenSections ?? [],
        },
        rules
      )
    ).filter((rule) => !acknowledged.has(rule.key));

    if (outstanding.length > 0) {
      return {
        ok: false,
        error: "Some of your ground rules are still open on this quote.",
      };
    }
  }

  const updated = await prisma.brief.update({ where: { id: briefId }, data: { published } });
  revalidatePath(`/quote/${briefId}`);
  return { ok: true, data: { publicSlug: updated.publicSlug } };
}

/**
 * "I meant it", for one blocking rule on one quote.
 *
 * Recorded rather than argued with. A freelancer quoting a two-hour job does
 * not need an assumptions list, and a rule that cannot be waved through is a
 * rule people learn to route around. What is stored is the rule's key against
 * this quote, so the flag stays quiet here and stays live everywhere else.
 */
export async function acknowledgeRuleAction(
  briefId: string,
  rule: string,
  acknowledged: boolean
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
    select: { id: true, settings: true },
  });
  if (!brief) return { ok: false, error: "Quote not found." };
  if (!ruleOf(rule)) return { ok: false, error: "That is not one of the rules." };

  const settings = (brief.settings as Record<string, unknown> | null) ?? {};
  const current = new Set((settings.rulesAcknowledged as string[] | undefined) ?? []);
  if (acknowledged) current.add(rule);
  else current.delete(rule);

  try {
    await prisma.brief.update({
      where: { id: brief.id },
      data: {
        settings: {
          ...settings,
          rulesAcknowledged: Array.from(current),
        } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[acknowledgeRuleAction] failed", err);
    return { ok: false, error: "Couldn't save that." };
  }

  if (acknowledged) {
    // Which rules get waved through, and how often. A blocking rule that is
    // always overridden is a blocking rule that is wrong.
    track("rule_overridden", { userId: user.id, subjectId: brief.id, detail: { rule } });
  }
  revalidatePath(`/quote/${briefId}`);
  return { ok: true, data: undefined };
}

/**
 * Doing what a broken rule asks for.
 *
 * The flag used to name a problem and stop, which left the freelancer to write
 * the clause themselves. That is the work they opened Freely to avoid, and a
 * flag you have to act on by hand is one you learn to wave through.
 *
 * So it runs the same refine everything else uses, with an instruction built
 * from the rule and the account's own figures. The quote comes back changed
 * in its own voice and language, the changed sections are named, and the page
 * scrolls to them exactly as it does for a refinement somebody typed.
 */
export async function applyRuleAction(
  briefId: string,
  rules: string | string[]
): Promise<ActionResult<{ changed: string[]; applied: string[] }>> {
  const user = await requireFullUser();
  const asked = Array.isArray(rules) ? rules : [rules];

  const settings = parseRuleSettings((user as unknown as { groundRules?: unknown }).groundRules);
  const values = ruleValues(settings);

  const applied: string[] = [];
  const instructions: string[] = [];
  for (const key of asked) {
    const found = ruleOf(key);
    if (!found) continue;
    const instruction = ruleFix(found.key, values);
    // The two rules about what happens before a quote exists. Nothing on the
    // document can satisfy them, so there is nothing to run.
    if (!instruction) continue;
    applied.push(found.key);
    instructions.push(instruction);
  }

  if (instructions.length === 0) {
    return { ok: false, error: "Those are about what you do, not about the quote." };
  }

  /**
   * All of them in one pass.
   *
   * Each of these used to be its own full rewrite of the quote, so settling
   * five meant waiting through five of them, one after another, each one
   * re-reading and re-writing everything the last had just finished. They are
   * independent clauses in different sections, so a single instruction listing
   * all of them produces the same result for a fifth of the wait.
   */
  const instruction =
    instructions.length === 1
      ? instructions[0]
      : `Make all of the following changes in one pass. They are separate and none of them replaces another:\n${instructions
          .map((line, i) => `${i + 1}. ${line}`)
          .join("\n")}`;

  const result = await refineBriefAction(briefId, instruction);
  if (!result.ok) return result;
  return { ok: true, data: { changed: result.data.changed, applied } };
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
/**
 * How the finished quote looks.
 *
 * Moved here from the wizard, which asked for a style and a brand before the
 * document existed. You were choosing how a thing would look without having
 * seen it, and then never saw the result until a client did. Beside a preview
 * these become choices with information behind them.
 *
 * Narrowed rather than trusted: both end up in a template lookup and an
 * unrecognised value would render the fallback with no explanation.
 */
const TEMPLATES = ["classic", "editorial", "minimal"];
const BRANDINGS = ["freely", "own", "mono-light", "mono-dark"];

export async function updateQuoteLookAction(
  briefId: string,
  patch: { template?: string; branding?: string }
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
    select: { id: true },
  });
  if (!brief) return { ok: false, error: "Quote not found." };

  const data: { template?: string; branding?: string } = {};
  if (patch.template && TEMPLATES.includes(patch.template)) data.template = patch.template;
  if (patch.branding && BRANDINGS.includes(patch.branding)) data.branding = patch.branding;
  if (Object.keys(data).length === 0) return { ok: true, data: undefined };

  try {
    await prisma.brief.update({ where: { id: brief.id }, data });
  } catch (err) {
    console.error("[updateQuoteLookAction] failed", err);
    return { ok: false, error: "Couldn't change that." };
  }

  revalidatePath(`/quote/${briefId}`);
  return { ok: true, data: undefined };
}

/**
 * Takes a section out of the quote, or puts it back.
 *
 * Removing rather than deleting: the content stays where it is and stops being
 * sent, so putting it back is one press. Deleting would make "remove" an
 * irreversible act on a paragraph that cost real money to write, and there is
 * no reason for it to be irreversible.
 *
 * Only removal. A section that was never generated has nothing behind it, so
 * adding one would produce an empty heading; that needs a refine, which the
 * page already offers.
 */
export async function toggleSectionAction(
  briefId: string,
  section: string,
  hidden: boolean
): Promise<ActionResult<string[]>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
  });
  if (!brief) return { ok: false, error: "Quote not found." };

  const current = (brief as unknown as { hiddenSections?: string[] }).hiddenSections ?? [];
  const key = sanitizeText(section);
  const next = hidden
    ? Array.from(new Set([...current, key]))
    : current.filter((s) => s !== key);

  try {
    await prisma.brief.update({
      where: { id: brief.id },
      data: { hiddenSections: next } as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error("[toggleSectionAction] failed", err);
    return { ok: false, error: "Couldn't change that." };
  }

  revalidatePath(`/quote/${briefId}`);
  return { ok: true, data: next };
}

/**
 * Writes the add-on sections for a quote whose core has already landed.
 *
 * Called once by the quote page when it finds extrasPending on a quote. The
 * page is already open and readable by then, which is the entire point of the
 * split: the wait ended at the price rather than at the confidentiality
 * clause.
 *
 * Everything about it is written to fail quietly. A quote with no terms is
 * still a quote, the flag is cleared either way so the page cannot ask again
 * forever, and the error is returned rather than thrown so a failure shows up
 * as a sentence rather than as a page that will not load.
 */
export async function generateExtrasAction(
  briefId: string
): Promise<ActionResult<{ written: boolean }>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
  });
  if (!brief) return { ok: false, error: "Quote not found." };

  const settings = (brief.settings as Record<string, unknown> | null) ?? {};
  // Already done, or never wanted. Either way there is nothing to write, and
  // saying so is cheaper than a second model call.
  if (!settings.extrasPending) return { ok: true, data: { written: false } };

  /**
   * The draft, rebuilt from what was stored.
   *
   * The wizard's draft object does not survive the round trip, and passing it
   * back from the client would let a page ask for sections the quote was never
   * set up with. Everything needed is on the quote already.
   */
  const draft: QuoteDraftPayload = {
    sourceText: brief.sourceText ?? "",
    instructions: typeof settings.instructions === "string" ? settings.instructions : "",
    memoryProjectTitles: Array.isArray(settings.memoryProjectTitles)
      ? (settings.memoryProjectTitles as string[])
      : [],
    format: (settings.format as "HTML" | "PDF" | "Figma") ?? "PDF",
    includeSOW: settings.includeSOW === true,
    includeAI: settings.includeAI === true,
    includeStrategy: settings.includeStrategy === true,
    includeTimeline: settings.includeTimeline === true,
    includeTerms: settings.includeTerms === true,
    includeRevisions: settings.includeRevisions === true,
    includeAvailability: settings.includeAvailability === true,
    includeAssumptions: settings.includeAssumptions === true,
    includeScopeChanges: settings.includeScopeChanges === true,
    chooseSections: settings.chooseSections === true,
    sectionNotes: (settings.sectionNotes as QuoteDraftPayload["sectionNotes"]) ?? undefined,
    availability: (settings.availability as QuoteDraftPayload["availability"]) ?? undefined,
    hourlyRate: brief.hourlyRate ?? 0,
    rateUnit: ((brief as unknown as { rateUnit?: string }).rateUnit ?? "HOUR") as
      | "HOUR"
      | "DAY"
      | "FIXED",
    currency: brief.currency ?? "USD",
    language: parseLocale((brief as unknown as { language?: string }).language),
    paymentPlan: (settings.paymentPlan as QuoteDraftPayload["paymentPlan"]) ?? "SPLIT",
    upfrontPercent: typeof settings.upfrontPercent === "number" ? settings.upfrontPercent : 50,
    expertiseLevel: (brief.expertiseLevel as QuoteDraftPayload["expertiseLevel"]) ?? "Senior",
  };

  let written = false;
  /**
   * Whether it is worth asking again later.
   *
   * Being rate limited is not a failure of the quote, it is a queue: somebody
   * generated three quotes in a minute and the second call for this one arrived
   * while the meter was full. Clearing the flag there would throw away sections
   * that were never written, silently and permanently, over a wait of a few
   * seconds. So the flag stays and the next visit to this quote finishes it.
   *
   * Every other failure clears the flag, because a quote that asks forever is
   * worse than a quote missing its terms.
   */
  let retryLater = false;
  let extras: (BriefExtras & { strategy?: Strategy }) | null = null;
  try {
    await enforceLlmRateLimit(user.id);
    extras = await generateQuoteExtras(await buildMemoryContext(user), draft, [], undefined);
    written = true;
  } catch (err) {
    retryLater = err instanceof RateLimitError;
    console.error("[generateExtrasAction] failed", err);
  }

  const generated = { ...(extras ?? {}) } as GeneratedBrief;
  const nextSettings: Record<string, unknown> = { ...settings, extrasPending: retryLater };

  if (written && extras) {
    // The sections the model chose are only knowable now, so the stored flags
    // are settled here rather than at generation.
    if (settings.chooseSections === true) {
      nextSettings.includeStrategy = hasStrategyContent(extras.strategy);
      nextSettings.includeSOW = Boolean(extras.paymentTerms);
      nextSettings.includeTerms = Boolean(extras.terms);
      nextSettings.includeRevisions = Boolean(extras.revisions);
      nextSettings.includeAvailability = Boolean(extras.availability);
      nextSettings.includeAssumptions = (extras.assumptions?.length ?? 0) > 0;
      nextSettings.includeScopeChanges = (extras.scopeChanges?.length ?? 0) > 0;
      nextSettings.includeAI = Boolean(extras.aiUsage);
    }
  }

  try {
    await prisma.brief.update({
      where: { id: brief.id },
      data: {
        ...(written && hasExtras(generated) ? { extras: sanitizeExtras(generated) } : {}),
        // The Approach arrives with the second half when the model is choosing
        // the sections, and the open questions ride inside it.
        ...(written && extras?.strategy ? { strategy: sanitizeStrategy(extras.strategy) } : {}),
        settings: nextSettings as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[generateExtrasAction] failed to save", err);
    return { ok: false, error: "The extra sections could not be saved." };
  }

  revalidatePath(`/quote/${briefId}`);
  if (written) return { ok: true, data: { written } };
  return {
    ok: false,
    error: retryLater
      ? "The extra sections are queued behind another quote. Open this one again in a moment and they will be written."
      : "The extra sections could not be written. The quote itself is fine.",
  };
}

/**
 * Ticks one of the AI's open questions off, or puts it back.
 *
 * Stored by the question's text rather than its position, because editing the
 * list reorders it and a position would then point at a different question. An
 * edited question is a different question, and it reappearing unticked is the
 * right behaviour: the thing that was checked is not the thing now written.
 *
 * These never reach the client. They are the notes worth confirming before
 * sending, and clearing them one at a time is what turns a block of text into
 * something that can be finished.
 */
export async function clearQuestionAction(
  briefId: string,
  question: string,
  cleared: boolean
): Promise<ActionResult<string[]>> {
  const user = await requireFullUser();
  // No select: the generated client in this workspace predates the column, so
  // narrowing to it would return undefined. Same contained-cast situation as
  // lib/track-db.
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
  });
  if (!brief) return { ok: false, error: "Quote not found." };

  const current = (brief as unknown as { clearedQuestions?: string[] }).clearedQuestions ?? [];
  const text = sanitizeText(question);
  const next = cleared
    ? Array.from(new Set([...current, text]))
    : current.filter((q) => q !== text);

  try {
    await prisma.brief.update({
      where: { id: brief.id },
      data: { clearedQuestions: next } as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error("[clearQuestionAction] failed", err);
    return { ok: false, error: "Couldn't save that." };
  }

  revalidatePath(`/quote/${briefId}`);
  return { ok: true, data: next };
}

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
    select: { id: true, price: true, deliverables: true, settings: true },
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
        // Editing the price or the deliverables by hand moves what the
        // milestones are shares of, so the shares are worked out again. A quote
        // billed any other way is untouched.
        ...(patch.price !== undefined || patch.deliverables !== undefined
          ? {
              settings: rebalancedSettings(
                (brief.settings as Record<string, unknown> | null) ?? {},
                patch.deliverables?.length ?? (brief.deliverables as string[]).length,
                patch.price ?? brief.price
              ) as unknown as Prisma.InputJsonValue,
            }
          : {}),
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

/**
 * Correcting which kind of work a quote is.
 *
 * The model names it from the freelancer's own list, and it will sometimes be
 * wrong: a brief that talks mostly about screens can turn out to be a build
 * job. One press to fix, and the fix is worth more than the label, because
 * this is what the next quote's pricing history anchors on. A wrong tag today
 * quietly skews a price next month.
 */
export async function setQuoteDisciplineAction(
  briefId: string,
  discipline: string
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const brief = await prisma.brief.findFirst({
    where: { id: briefId, ...teamScopeWhere(user) },
    select: { id: true, settings: true },
  });
  if (!brief) return { ok: false, error: "Quote not found." };

  // Theirs, or nothing. This is a stored fact other quotes read.
  const mine = allDisciplines(
    user.industry,
    (user as unknown as { otherIndustries?: string[] }).otherIndustries
  );
  if (!mine.includes(discipline)) {
    return { ok: false, error: "That is not one of the kinds of work on your account." };
  }

  const settings = (brief.settings as Record<string, unknown> | null) ?? {};

  try {
    await prisma.brief.update({
      where: { id: brief.id },
      data: {
        settings: { ...settings, discipline } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[setQuoteDisciplineAction] failed", err);
    return { ok: false, error: "Couldn't change that." };
  }

  revalidatePath(`/quote/${briefId}`);
  return { ok: true, data: undefined };
}
