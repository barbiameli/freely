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
    },
  });
  redirect("/quote");
}
