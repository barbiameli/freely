import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Strategy } from "@/lib/anthropic";
import { resolveBrand } from "@/lib/branding";
import { ClassicTemplate, EditorialTemplate, MinimalTemplate, MonoTemplate, type PublicBrief } from "./templates";

export const dynamic = "force-dynamic";

/** Public, no-login "HTML page" quote — what the Quote wizard's "HTML page"
 * format option actually links to. Mirrors the public Diary page pattern
 * (/p/[slug]) but for a Brief instead of a Project. Renders one of the 3
 * layout templates (classic/editorial/minimal) with the branding chosen when
 * the quote was created, or the dedicated Mono layout for the two
 * brandless presets (see lib/branding.ts). */
export default async function PublicQuotePage({ params }: { params: { slug: string } }) {
  const brief = await prisma.brief.findUnique({
    where: { publicSlug: params.slug },
    include: {
      user: {
        select: { brandPrimaryColor: true, brandAccentColor: true, brandLogoDataUrl: true },
      },
      examples: { orderBy: { order: "asc" } },
    },
  });

  if (!brief || !brief.published) notFound();

  const publicBrief: PublicBrief = {
    title: brief.title,
    client: brief.client,
    scope: brief.scope,
    deliverables: brief.deliverables as string[],
    timeline: brief.timeline,
    strategy: (brief.strategy as Strategy | null) ?? null,
    price: brief.price,
    hours: brief.hours,
    hourlyRate: brief.hourlyRate,
    currency: brief.currency,
    examples: brief.examples.map((e) => ({ name: e.name, dataUrl: e.dataUrl, caption: e.caption })),
  };

  const resolved = resolveBrand(brief.branding, brief.user);
  if (resolved.mono) return <MonoTemplate brief={publicBrief} dark={resolved.dark} />;

  const brand = { primary: resolved.primary, accent: resolved.accent, logoDataUrl: resolved.logoDataUrl };

  if (brief.template === "editorial") return <EditorialTemplate brief={publicBrief} brand={brand} />;
  if (brief.template === "minimal") return <MinimalTemplate brief={publicBrief} brand={brand} />;
  return <ClassicTemplate brief={publicBrief} brand={brand} />;
}
