"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import {
  generatePersona,
  analyzeBrandGuide,
  analyzeBrandGuideFromImage,
  type BrandGuideAnalysis,
} from "@/lib/anthropic";
import { extractDominantColor } from "@/lib/png-color";
import { sanitizeText } from "@/lib/sanitize-text";
import { enforceLlmRateLimit } from "@/lib/rate-limit";
import { parseLocale } from "@/lib/i18n";
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
    // Sanitized again here even though extraction already cleans it: this is
    // a server action taking client-supplied text, so it can be reached with
    // anything. A NUL byte would fail the insert with an opaque Postgres
    // error rather than anything the user could act on.
    data: {
      userId: user.id,
      type: "FILE",
      name: sanitizeText(name),
      textContent: sanitizeText(text),
    },
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

  let persona: Awaited<ReturnType<typeof generatePersona>>;
  try {
    await enforceLlmRateLimit(user.id);
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
    data: {
      aiPersona: persona.summary,
      personaUpdatedAt: new Date(),
      // Stored apart from expertiseLevel, which is what the freelancer said.
      // An inference must never overwrite a correction, so it is written to
      // its own column and only read when nothing was stated.
      ...(persona.expertise
        ? ({
            inferredExpertise: persona.expertise,
            inferredExpertiseAt: new Date(),
          } as Record<string, unknown>)
        : {}),
    },
  });
  revalidatePath("/memory");
  return { ok: true, data: { persona: persona.summary } };
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

/** Reads a PNG's IHDR chunk directly (no image-processing dependency needed)
 * to check it actually has an alpha channel and meets a minimum resolution,
 * before it's accepted as a logo. PNG layout: 8-byte signature, then the
 * IHDR chunk — 4-byte length, "IHDR", 4-byte width, 4-byte height, 1-byte
 * bit depth, 1-byte color type, ... Color type 6 = truecolor+alpha,
 * 4 = greyscale+alpha; anything else has no transparency. */
function readPngHeader(buffer: Buffer): { width: number; height: number; hasAlpha: boolean } | null {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.toString("ascii", 12, 16) !== "IHDR") return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer.readUInt8(25);
  const hasAlpha = colorType === 6 || colorType === 4;
  return { width, height, hasAlpha };
}

const MIN_LOGO_DIMENSION = 200;

/** Uploads a logo used in place of the "Freely" wordmark on public pages.
 * Requires a transparent PNG at a reasonable resolution — anything else is
 * rejected outright rather than silently used, since a logo on a white
 * rectangle or a blurry upload looks broken everywhere it's placed. */
export async function uploadBrandLogoAction(
  formData: FormData
): Promise<ActionResult<{ suggestedColor: string | null }>> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file provided." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Logos are limited to 2MB." };
  if (file.type !== "image/png") {
    return { ok: false, error: "Logo must be a PNG with a transparent background (not JPG or other formats)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const header = readPngHeader(buffer);
  if (!header) return { ok: false, error: "That doesn't look like a valid PNG file." };
  if (!header.hasAlpha) {
    return {
      ok: false,
      error: "This PNG doesn't have a transparent background, export it with a transparent canvas, not a white one.",
    };
  }
  if (header.width < MIN_LOGO_DIMENSION || header.height < MIN_LOGO_DIMENSION) {
    return {
      ok: false,
      error: `Too low-resolution (${header.width}×${header.height}px), upload at least ${MIN_LOGO_DIMENSION}×${MIN_LOGO_DIMENSION}px.`,
    };
  }

  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

  // If they haven't picked a brand color yet, take a stab at one from the
  // logo itself instead of leaving it at Freely's default coral — easy to
  // override afterward in the color pickers below, this is just a better
  // starting point than "no relationship to their actual brand at all."
  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { brandPrimaryColor: true },
  });
  const suggestedColor = existing?.brandPrimaryColor ? null : extractDominantColor(buffer);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      brandLogoDataUrl: dataUrl,
      ...(suggestedColor ? { brandPrimaryColor: suggestedColor } : {}),
    },
  });
  revalidatePath("/memory");
  return { ok: true, data: { suggestedColor } };
}

/** Reads an uploaded brand guidelines PDF (already text-extracted client-side
 * via /api/extract-text, same as everywhere else a PDF gets read) and
 * applies whatever colors/fonts Claude can find directly to the user's
 * branding — colors take effect immediately; fonts are stored and shown to
 * the user, informational for now. */
export async function analyzeBrandGuideAction(
  text: string
): Promise<ActionResult<BrandGuideAnalysis>> {
  const user = await requireUser();
  if (!text.trim()) return { ok: false, error: "Couldn't read any text out of that file." };

  let analysis: BrandGuideAnalysis;
  try {
    await enforceLlmRateLimit(user.id);
    analysis = await analyzeBrandGuide(text);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't analyze that brand guide right now.",
    };
  }

  await applyBrandGuideAnalysis(user.id, analysis);
  revalidatePath("/memory");
  return { ok: true, data: analysis };
}

async function applyBrandGuideAnalysis(userId: string, analysis: BrandGuideAnalysis): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(analysis.primaryColor ? { brandPrimaryColor: analysis.primaryColor } : {}),
      ...(analysis.accentColor ? { brandAccentColor: analysis.accentColor } : {}),
      ...(analysis.headingFont ? { brandHeadingFont: analysis.headingFont } : {}),
      ...(analysis.bodyFont ? { brandBodyFont: analysis.bodyFont } : {}),
    },
  });
}

const ALLOWED_BRAND_GUIDE_IMAGE_TYPES = ["image/png", "image/jpeg"] as const;

/** Same job as analyzeBrandGuideAction, but for a PNG/JPG screenshot of a
 * brand guide (a moodboard, an exported style-guide page) instead of a
 * text-extractable document — read directly by Claude's vision, since
 * there's no text to extract out of a picture. */
export async function analyzeBrandGuideImageAction(
  dataUrl: string
): Promise<ActionResult<BrandGuideAnalysis>> {
  const user = await requireUser();

  const match = dataUrl.match(/^data:(image\/png|image\/jpeg);base64,(.+)$/);
  if (!match) {
    return { ok: false, error: "That doesn't look like a PNG or JPG image." };
  }
  const [, mediaType, base64Data] = match;
  if (!ALLOWED_BRAND_GUIDE_IMAGE_TYPES.includes(mediaType as (typeof ALLOWED_BRAND_GUIDE_IMAGE_TYPES)[number])) {
    return { ok: false, error: "Only PNG or JPG images are supported." };
  }

  let analysis: BrandGuideAnalysis;
  try {
    await enforceLlmRateLimit(user.id);
    analysis = await analyzeBrandGuideFromImage(base64Data, mediaType as "image/png" | "image/jpeg");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't analyze that brand guide right now.",
    };
  }

  await applyBrandGuideAnalysis(user.id, analysis);
  revalidatePath("/memory");
  return { ok: true, data: analysis };
}

export async function deleteMemoryAssetAction(assetId: string): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  const asset = await prisma.memoryAsset.findFirst({ where: { id: assetId, userId: user.id } });
  if (!asset) return { ok: false, error: "Asset not found." };
  await prisma.memoryAsset.delete({ where: { id: assetId } });
  revalidatePath("/memory");
  return { ok: true, data: undefined };
}

/**
 * The rate this freelancer usually charges.
 *
 * Saved once and prefilled into every quote, since retyping it each time is
 * both tedious and a chance to fat-finger a digit. Still editable per quote:
 * one job is not always priced like the last.
 */
/**
 * The language client-facing quotes get written in.
 *
 * `null` means follow the interface language, which is why this takes a
 * nullable value rather than defaulting to one: an account that has never
 * touched this should move with the interface rather than sit on whatever was
 * guessed from the browser at signup.
 */
export async function updateQuoteLocaleAction(
  locale: string | null
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const value = locale === null ? null : parseLocale(locale);

  await prisma.user.update({
    where: { id: user.id },
    // The generated client in this environment predates this column; see
    // lib/track-db for the same situation.
    data: { quoteLocale: value } as unknown as Parameters<
      typeof prisma.user.update
    >[0]["data"],
  });
  revalidatePath("/memory");
  revalidatePath("/quote");
  return { ok: true, data: undefined };
}

export async function updateDefaultRateAction(patch: {
  rate: number;
  unit: "HOUR" | "DAY";
  currency?: string;
}): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  if (!Number.isFinite(patch.rate) || patch.rate < 0) {
    return { ok: false, error: "That rate isn't a number." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      // The generated client in this environment predates these columns; see
      // lib/track-db for the same situation.
      ...({
        defaultRate: patch.rate > 0 ? patch.rate : null,
        defaultRateUnit: patch.unit,
        ...(patch.currency ? { currency: patch.currency } : {}),
      } as Record<string, unknown>),
    },
  });
  revalidatePath("/memory");
  revalidatePath("/quote");
  return { ok: true, data: undefined };
}
