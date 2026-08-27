import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { renderBriefPdf, type StrategyPdfData, type PdfTemplate } from "@/lib/pdf";
import type { BriefExtras } from "@/lib/anthropic";
import { resolveBrand } from "@/lib/branding";
import { milestonesFromSettings } from "@/lib/milestone-lines";
import { layoutOf } from "@/lib/quote-layout";

const VALID_TEMPLATES: PdfTemplate[] = ["classic", "editorial", "minimal"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return new NextResponse("Unauthorized", { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const brief = await prisma.brief.findFirst({
    where: { id: params.id, ...teamScopeWhere(user) },
    include: { examples: { orderBy: { order: "asc" } } },
  });
  if (!brief) return new NextResponse("Not found", { status: 404 });

  const settings = (brief.settings as { includeSOW?: boolean; includeAI?: boolean } | null) ?? {};

  // Template is a per-download choice (picked in the UI right before
  // clicking "Download PDF"), not persisted on the brief — falls back to
  // the brief's own template (used for the public HTML page) if unset.
  const requestedTemplate = req.nextUrl.searchParams.get("template");
  const template: PdfTemplate = VALID_TEMPLATES.includes(requestedTemplate as PdfTemplate)
    ? (requestedTemplate as PdfTemplate)
    : VALID_TEMPLATES.includes(brief.template as PdfTemplate)
    ? (brief.template as PdfTemplate)
    : "classic";

  const resolved = resolveBrand(brief.branding, user);

  const pdf = await renderBriefPdf({
    title: brief.title,
    client: brief.client,
    scope: brief.scope,
    deliverables: brief.deliverables as string[],
    timeline: brief.timeline,
    strategy: brief.strategy as StrategyPdfData | null,
    extras: brief.extras as BriefExtras | null,
    // The split the client is agreeing to. It was on the editing screen only,
    // so a quote billed per milestone went out saying nothing about them.
    milestones: milestonesFromSettings(brief.settings),
    layout: layoutOf(brief.settings),
    price: brief.price,
    hours: brief.hours,
    rateUnit: (brief as unknown as { rateUnit?: string }).rateUnit ?? "HOUR",
    // Cast for the same reason rateUnit above is: the column is newer than the
    // generated client. Without this the document renders in English however
    // the quote was written.
    language: (brief as unknown as { language?: string }).language ?? "en",
    hourlyRate: brief.hourlyRate,
    currency: brief.currency,
    createdAt: brief.createdAt.toISOString(),
    includeSOW: settings.includeSOW,
    includeAI: settings.includeAI,
    brandPrimaryColor: resolved.primary,
    brandAccentColor: resolved.accent,
    brandLogoDataUrl: resolved.logoDataUrl,
    mono: resolved.mono,
    dark: resolved.dark,
    examples: brief.examples.map((e) => ({ name: e.name, dataUrl: e.dataUrl, caption: e.caption })),
    preparedByEmail: user.email,
    template,
  });

  const fileName = `${brief.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-quote.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
