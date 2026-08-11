import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import type { Strategy, BriefExtras } from "@/lib/anthropic";
import { BriefView } from "./brief-view";

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

  const history = await prisma.brief.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true },
    take: 12,
  });

  return (
    <BriefView
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
      history={history}
    />
  );
}
