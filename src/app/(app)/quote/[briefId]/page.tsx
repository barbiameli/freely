import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GuideMount } from "@/components/guide/guide-mount";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import type { Strategy, BriefExtras } from "@/lib/anthropic";
import { BriefView } from "./brief-view";
import { layoutOf } from "@/lib/quote-layout";
import { billingFromSettings } from "@/lib/quote-definitions";
import { parseRuleSettings } from "@/lib/ground-rules";
import { allDisciplines, industryLabel } from "@/lib/industries";

export default async function BriefPage({ params }: { params: { briefId: string } }) {
  const user = await requireFullUser();
  const scope = teamScopeWhere(user);
  const brief = await prisma.brief.findFirst({
    where: { id: params.briefId, ...scope },
    include: { examples: { orderBy: { order: "asc" } } },
  });
  if (!brief) notFound();

  // The generated Prisma client in this sandbox predates these columns; the
  // schema has them and the deploy build regenerates it.
  const acceptance = brief as unknown as {
    acceptedAt: Date | null;
    acceptedName: string | null;
    acceptedEmail: string | null;
  };

  return (
    <>

    <BriefView
      rules={parseRuleSettings((user as unknown as { groundRules?: unknown }).groundRules)}
      brief={{
        id: brief.id,
        title: brief.title,
        client: brief.client,
        scope: brief.scope,
        deliverables: brief.deliverables as string[],
        timeline: brief.timeline,
        strategy: (brief.strategy as Strategy | null) ?? null,
        extras: (brief.extras as BriefExtras | null) ?? null,
        currency: brief.currency,
        price: brief.price,
        hours: brief.hours,
        rateUnit: (brief as unknown as { rateUnit?: string }).rateUnit ?? "HOUR",
        hourlyRate: brief.hourlyRate,
        status: brief.status,
        createdAt: brief.createdAt.toISOString(),
        published: brief.published,
        publicSlug: brief.publicSlug,
        template: brief.template,
        // Everything the preview needs to draw the real thing rather than an
        // approximation of it.
        branding: brief.branding,
        language: (brief as unknown as { language?: string }).language ?? "en",
        signable: Boolean((brief.settings as { includeSOW?: boolean } | null)?.includeSOW),
        clearedQuestions:
          (brief as unknown as { clearedQuestions?: string[] }).clearedQuestions ?? [],
        layout: layoutOf(brief.settings),
        billing: billingFromSettings(brief.settings),
        rulesAcknowledged:
          ((brief.settings as { rulesAcknowledged?: string[] } | null) ?? {}).rulesAcknowledged ??
          [],
        discipline:
          ((brief.settings as { discipline?: string } | null) ?? {}).discipline ?? null,
        extrasPending:
          ((brief.settings as { extrasPending?: boolean } | null) ?? {}).extrasPending === true,
        hiddenSections:
          (brief as unknown as { hiddenSections?: string[] }).hiddenSections ?? [],
        // The milestone split, so it can be checked before the quote goes out.
        // Stored on the quote at generation, because that is what the client
        // agrees to.
        milestones:
          (brief.settings as { useMilestones?: boolean; milestones?: unknown } | null)
            ?.useMilestones
            ? ((brief.settings as {
                milestones?: {
                  name: string;
                  deliverableIndexes: number[];
                  gate?: string;
                  amount: number;
                }[];
              })
                .milestones ?? [])
            : [],
        accepted: acceptance.acceptedAt
          ? {
              name: acceptance.acceptedName || "the client",
              email: acceptance.acceptedEmail || "",
              at: acceptance.acceptedAt.toISOString(),
            }
          : null,
        sourceText: brief.sourceText,
        examples: brief.examples.map((e) => ({
          id: e.id,
          name: e.name,
          dataUrl: e.dataUrl,
          caption: e.caption,
        })),
      }}
      // What this account does, so a wrong guess can be corrected in one press.
      disciplines={allDisciplines(
        user.industry,
        (user as unknown as { otherIndustries?: string[] }).otherIndustries
      ).map((key) => ({ key, label: industryLabel(key) }))}
      brand={{
        brandPrimaryColor: user.brandPrimaryColor,
        brandAccentColor: user.brandAccentColor,
        brandLogoDataUrl: user.brandLogoDataUrl,
      }}
    />
      <GuideMount screen="/quote/brief" />
    </>
  );
}
