"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { disconnectCalendar } from "@/lib/google-calendar";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "@/actions/briefs";

export type Provider = "FIGMA" | "NOTION" | "GITHUB" | "GOOGLE_CALENDAR";

export async function disconnectProviderAction(provider: Provider): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  // Calendar goes through its own path, which revokes the grant at Google
  // before deleting the row. Deleting our copy alone would leave a credential
  // that still works and that nobody can see to remove.
  if (provider === "GOOGLE_CALENDAR") {
    await disconnectCalendar(user.id);
    revalidatePath("/memory");
    return { ok: true, data: undefined };
  }
  await prisma.connection.deleteMany({ where: { userId: user.id, provider: provider as never } });
  revalidatePath("/memory");
  return { ok: true, data: undefined };
}
