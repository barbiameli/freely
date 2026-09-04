"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { planQuoteAction } from "@/actions/plan";
import { requireFullUser } from "@/lib/session";
import type { ActionResult } from "@/actions/briefs";

/**
 * The tools for testing Freely on a real account.
 *
 * Everything here is destructive and admin-only, gated the same way /insights
 * is: ADMIN_EMAIL, failing closed when it is unset. These are not features, and
 * a freelancer finding a button that empties their account would be a very bad
 * afternoon.
 *
 * They exist because the alternative was making a new account with a new email
 * for every run through onboarding, which is slow enough that onboarding stops
 * being tested. A first run is the one experience nobody who built the product
 * can have twice, so it needs to be replayable on demand.
 */
async function requireAdmin() {
  const user = await requireFullUser();
  const admin = process.env.ADMIN_EMAIL;
  if (!admin || user.email.toLowerCase() !== admin.toLowerCase()) {
    // Deliberately the same message a stranger would get. There is nothing to
    // learn from it about whether the feature exists.
    throw new Error("Not found.");
  }
  return user;
}

/**
 * Sends this account back through onboarding.
 *
 * Industry is what the app checks: no industry means the layout redirects to
 * /onboarding before anything else renders. The guide flags go too, so the
 * coach marks appear again in the order a new account meets them.
 *
 * Nothing else is touched. Quotes, Memory and projects all survive, which is
 * the point: this replays the first-run experience against an account that
 * already has history, which is a state a brand new account cannot show you.
 */
export async function replayOnboardingAction(): Promise<ActionResult<undefined>> {
  const user = await requireAdmin();

  await prisma.user.update({
    where: { id: user.id },
    data: { industry: null, guideSeen: [] } as unknown as Record<string, unknown>,
  });

  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Everything this account has made, gone, without deleting the login.
 *
 * Quotes, projects, invoices, notifications and Memory. The account itself,
 * its email and its password stay, so the next sign-in works and lands on
 * onboarding as a genuinely new account would.
 *
 * Deletes are by userId rather than by walking relations: the schema cascades
 * from Brief and Project to their examples, deliverables, steps, flags,
 * milestones and diary entries, so four deletes cover everything a person made.
 *
 * Events are left alone. They carry no content, they are how the product is
 * measured over time, and wiping them to tidy up one test account would put a
 * hole in every chart on /insights.
 */
export async function resetMyAccountAction(): Promise<ActionResult<{ deleted: number }>> {
  const user = await requireAdmin();

  const [briefs, projects, invoices, assets] = await prisma.$transaction([
    prisma.brief.deleteMany({ where: { userId: user.id } }),
    prisma.project.deleteMany({ where: { userId: user.id } }),
    prisma.invoice.deleteMany({ where: { userId: user.id } }),
    prisma.memoryAsset.deleteMany({ where: { userId: user.id } }),
  ]);

  await prisma.notification.deleteMany({ where: { userId: user.id } });

  // Memory's written half, and the setup it learned. Left as empty strings
  // rather than null because that is what a new account has: the columns are
  // not nullable and the difference between "" and null would show up as a
  // different first run.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      industry: null,
      guideSeen: [],
      memoryInstructions: "",
      toneNotes: "",
      storyNotes: "",
      contextNotes: "",
      defaultRate: null,
      defaultRateUnit: null,
      defaultPaymentPlan: null,
      defaultUpfrontPercent: null,
      defaultSections: undefined,
      defaultTermsNote: null,
      defaultRevisionsNote: null,
      defaultAiUsageNote: null,
      defaultAvailabilityNote: null,
      defaultFormat: null,
      defaultTemplate: null,
      defaultBranding: null,
      expertiseLevel: null,
      inferredExpertise: null,
      country: null,
    } as unknown as Record<string, unknown>,
  });

  revalidatePath("/", "layout");
  return {
    ok: true,
    data: {
      deleted: briefs.count + projects.count + invoices.count + assets.count,
    },
  };
}

/**
 * Running a brief through the reading step, and nothing else.
 *
 * Tuning the plan prompt meant generating a whole quote each time: two model
 * calls, a stored brief, a client record and a row in the list, to look at a
 * paragraph and five section names. So the prompt got tuned rarely and by
 * guesswork.
 *
 * This is the same call the wizard makes, with the result handed back whole
 * and nothing written down. Admin-only, because it is a workbench rather than
 * a feature, and because it spends a model call per press.
 */
export async function tryReadingAction(input: {
  sourceText: string;
  instructions?: string;
  client?: string;
}): Promise<
  | { ok: true; data: { plan: unknown; ms: number } }
  | { ok: false; error: string; reason?: string }
> {
  try {
    await requireAdmin();
    const startedAt = Date.now();
    const result = await planQuoteAction(input);
    const ms = Date.now() - startedAt;

    // Failures come back as themselves rather than as an empty result: which
    // of the three happened is most of what there is to learn here.
    if (!result.ok) return { ok: false, error: result.error, reason: result.reason };
    return { ok: true, data: { plan: result.data, ms } };
  } catch {
    return { ok: false, error: "Not found." };
  }
}
