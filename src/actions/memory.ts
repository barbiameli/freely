"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { generatePersona } from "@/lib/anthropic";
import type { ActionResult } from "@/actions/briefs";

export async function updateMemoryInstructionsAction(
  instructions: string
): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { memoryInstructions: instructions },
  });
  revalidatePath("/memory");
  return { ok: true, data: undefined };
}

type NotesField = "toneNotes" | "storyNotes" | "contextNotes";

export async function updateMemoryNotesAction(
  field: NotesField,
  value: string
): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { [field]: value } });
  revalidatePath("/memory");
  return { ok: true, data: undefined };
}

/** Saves a Memory "Files" asset. Text extraction happens client-side first
 * via POST /api/extract-text (a Route Handler — pdf-parse doesn't survive
 * the server-action bundler), and the already-extracted text is what gets
 * passed in here to store and later inject into the Claude system prompt. */
export async function saveMemoryFileAction(
  name: string,
  text: string
): Promise<ActionResult<{ id: string; name: string }>> {
  const user = await requireUser();
  if (!name.trim()) return { ok: false, error: "File needs a name." };
  const asset = await prisma.memoryAsset.create({
    data: { userId: user.id, type: "FILE", name, textContent: text },
  });
  revalidatePath("/memory");
  return { ok: true, data: { id: asset.id, name: asset.name } };
}

/** Uploads a Memory "Images" asset — stored as a data URL (fine at the small
 * scale of a single studio's brand assets; swap for object storage if this
 * grows). Not yet passed to Claude — vision input is future work. */
export async function uploadMemoryImageAction(
  formData: FormData
): Promise<ActionResult<{ id: string; name: string }>> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file provided." };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: "Images are limited to 4MB for now." };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  const asset = await prisma.memoryAsset.create({
    data: { userId: user.id, type: "IMAGE", name: file.name, dataUrl },
  });
  revalidatePath("/memory");
  return { ok: true, data: { id: asset.id, name: asset.name } };
}

/** Saves a Memory "Links" reference — a URL to a portfolio piece, style
 * guide, or brand doc, without needing a file upload. */
export async function saveMemoryLinkAction(
  name: string,
  url: string
): Promise<ActionResult<{ id: string; name: string }>> {
  const user = await requireUser();
  if (!name.trim()) return { ok: false, error: "Give the link a name." };
  if (!/^https?:\/\//i.test(url.trim())) return { ok: false, error: "Add a valid URL (starting with http:// or https://)." };
  const asset = await prisma.memoryAsset.create({
    data: { userId: user.id, type: "LINK", name: name.trim(), url: url.trim() },
  });
  revalidatePath("/memory");
  return { ok: true, data: { id: asset.id, name: asset.name } };
}

/** Regenerates the AI-synthesized persona from everything saved to Memory
 * (Story/Tone/Context/Files/industry) plus past project titles. Always
 * overwritable by the user afterward via updatePersonaAction. */
export async function generatePersonaAction(): Promise<ActionResult<{ persona: string }>> {
  const user = await requireFullUser();
  const [files, pastProjects] = await Promise.all([
    prisma.memoryAsset.findMany({
      where: { userId: user.id, type: "FILE" },
      select: { name: true, textContent: true },
    }),
    prisma.project.findMany({
      where: teamScopeWhere(user),
      select: { title: true },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let persona: string;
  try {
    persona = await generatePersona({
      industry: user.industry,
      toneNotes: user.toneNotes,
      storyNotes: user.storyNotes,
      contextNotes: user.contextNotes,
      fileExcerpts: files
        .filter((f) => f.textContent)
        .map((f) => ({ name: f.name, text: f.textContent as string })),
      pastProjectTitles: pastProjects.map((p) => p.title),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't generate a persona right now.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { aiPersona: persona, personaUpdatedAt: new Date() },
  });
  revalidatePath("/memory");
  return { ok: true, data: { persona } };
}

/** Lets the user hand-correct the AI-synthesized persona directly. */
export async function updatePersonaAction(text: string): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { aiPersona: text, personaUpdatedAt: new Date() },
  });
  revalidatePath("/memory");
  return { ok: true, data: undefined };
}

/** Saves branding preferences applied to the public client site, public
 * quote pages, and PDF export. All optional — falls back to Freely's look. */
export async function updateBrandingAction(patch: {
  brandPrimaryColor?: string | null;
  brandAccentColor?: string | null;
  currency?: string;
}): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: patch });
  revalidatePath("/memory");
  return { ok: true, data: undefined };
}

/** Uploads a logo used in place of the "Freely" wordmark on public pages. */
export async function uploadBrandLogoAction(formData: FormData): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file provided." };
  if (file.size > 1 * 1024 * 1024) return { ok: false, error: "Logos are limited to 1MB." };
  const buffer = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  await prisma.user.update({ where: { id: user.id }, data: { brandLogoDataUrl: dataUrl } });
  revalidatePath("/memory");
  return { ok: true, data: undefined };
}

export async function deleteMemoryAssetAction(assetId: string): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  const asset = await prisma.memoryAsset.findFirst({ where: { id: assetId, userId: user.id } });
  if (!asset) return { ok: false, error: "Asset not found." };
  await prisma.memoryAsset.delete({ where: { id: assetId } });
  revalidatePath("/memory");
  return { ok: true, data: undefined };
}
