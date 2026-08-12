"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { INDUSTRY_OPTIONS } from "@/lib/industries";

export interface OnboardingMemoryInput {
  industry: string;
  instructions?: string;
  toneNotes?: string;
  storyNotes?: string;
  contextNotes?: string;
  /**
   * What they charge and how they usually get paid.
   *
   * Asked here so the first quote is already the short version: the wizard
   * reads these as its usual setup rather than as a form to fill in. All
   * optional, since somebody who does not know their rate yet should be able
   * to get to a quote and have one researched.
   */
  rate?: number;
  rateUnit?: string;
  currency?: string;
  paymentPlan?: string;
  upfrontPercent?: number;
  /** Only asked when they said they do not know their rate, since that is the
   * only case where it changes a number. */
  expertiseLevel?: string;
}

/** Completes onboarding — industry is required, everything else is
 * optional (steps can be skipped in the UI). Whatever's filled in gets
 * saved to the same Memory fields the Memory page edits later, so nothing
 * has to be re-entered. */
export async function completeOnboardingAction(input: OnboardingMemoryInput) {
  const user = await requireUser();
  const valid = INDUSTRY_OPTIONS.some((i) => i.key === input.industry);
  if (!valid) throw new Error("Pick one of the listed categories.");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      industry: input.industry,
      ...(input.instructions?.trim() ? { memoryInstructions: input.instructions.trim() } : {}),
      ...(input.toneNotes?.trim() ? { toneNotes: input.toneNotes.trim() } : {}),
      ...(input.storyNotes?.trim() ? { storyNotes: input.storyNotes.trim() } : {}),
      ...(input.contextNotes?.trim() ? { contextNotes: input.contextNotes.trim() } : {}),
      // The quote setup. Cast because these columns are newer than the
      // generated client in this workspace.
      ...({
        ...(input.rate && input.rate > 0
          ? { defaultRate: input.rate, defaultRateUnit: input.rateUnit ?? "HOUR" }
          : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.paymentPlan ? { defaultPaymentPlan: input.paymentPlan } : {}),
        ...(input.upfrontPercent ? { defaultUpfrontPercent: input.upfrontPercent } : {}),
        ...(input.expertiseLevel ? { expertiseLevel: input.expertiseLevel } : {}),
      } as Record<string, unknown>),
    },
  });
  redirect("/quote");
}
