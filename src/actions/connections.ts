"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "@/actions/briefs";

export type Provider = "FIGMA" | "NOTION" | "GITHUB";

export async function disconnectProviderAction(provider: Provider): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  await prisma.connection.deleteMany({ where: { userId: user.id, provider } });
  revalidatePath("/memory");
  return { ok: true, data: undefined };
}
