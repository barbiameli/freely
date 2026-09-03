import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Strategy, BriefExtras } from "@/lib/anthropic";
import { LocaleProvider } from "@/lib/i18n/context";
import { parseLocale } from "@/lib/i18n";
import type { PublicBrief } from "./templates";
import { RenderedQuote } from "@/components/quote/rendered-quote";
import { applyHiddenSections } from "@/lib/hidden-sections";
import { milestonesFromSettings } from "@/lib/milestone-lines";
import { billingFromSettings } from "@/lib/quote-definitions";
import { layoutOf } from "@/lib/quote-layout";

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

  const settings = (brief.settings as { includeSOW?: boolean } | null) ?? {};
  // Same reason as in actions/acceptance.ts: the sandbox's generated Prisma
  // client predates these columns, though the schema has them.
  const acceptance = brief as unknown as { acceptedAt: Date | null; acceptedName: string | null };

  const hiddenSections =
    (brief as unknown as { hiddenSections?: string[] }).hiddenSections ?? [];

  const publicBrief: PublicBrief = applyHiddenSections({
    title: brief.title,
    client: brief.client,
    scope: brief.scope,
    deliverables: brief.deliverables as string[],
    timeline: brief.timeline,
    strategy: (brief.strategy as Strategy | null) ?? null,
    // Only when the quote is actually billed this way. See milestone-lines.
    milestones: milestonesFromSettings(brief.settings),
    billing: billingFromSettings(brief.settings),
    // The layout this quote was written for, so a page a client already has
    // keeps the shape it had when they were sent it.
    layout: layoutOf(brief.settings),
    extras: (brief.extras as BriefExtras | null) ?? null,
    price: brief.price,
    hours: brief.hours,
    rateUnit: (brief as unknown as { rateUnit?: string }).rateUnit ?? "HOUR",
    language: (brief as unknown as { language?: string }).language ?? "en",
    hourlyRate: brief.hourlyRate,
    currency: brief.currency,
    examples: brief.examples.map((e) => ({ name: e.name, dataUrl: e.dataUrl, caption: e.caption })),
    slug: params.slug,
    // Accepting a bare price estimate isn't meaningful, so signing is only
    // offered when the quote carries a Statement of Work.
    signable: Boolean(settings.includeSOW),
    accepted: acceptance.acceptedAt
      ? {
          name: acceptance.acceptedName || "the client",
          at: acceptance.acceptedAt.toISOString(),
        }
      : null,
  }, hiddenSections);

  // The same component the editing page previews with, so the freelancer is
  // looking at this rather than at an approximation of it.
  const template = (
    <RenderedQuote
      brief={publicBrief}
      branding={brief.branding}
      template={brief.template}
      user={brief.user}
    />
  );

  /**
   * The page had no provider, so the acceptance block underneath it, which is
   * a client component reading useT(), fell through to the context default and
   * rendered in English. On a Spanish quote that meant the one paragraph the
   * client actually agrees to, and the checkbox they tick, were in the wrong
   * language. Nothing failed: a missing provider has a working default.
   *
   * The quote's language, not the visitor's browser. The client reads what the
   * quote was written in.
   */
  return <LocaleProvider locale={parseLocale(publicBrief.language)}>{template}</LocaleProvider>;
}
