import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import type { Strategy } from "@/lib/anthropic";
import { BriefView } from "./brief-view";

export default async function BriefPage({ params }: { params: { briefId: string } }) {
  const user = await requireFullUser();
  const scope = teamScopeWhere(user);
  const brief = await prisma.brief.findFirst({
    where: { id: params.briefId, ...scope },
    include: { examples: { orderBy: { order: "asc" } } },
  });
  if (!brief) notFound();

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
        currency: brief.currency,
        price: brief.price,
        hours: brief.hours,
        hourlyRate: brief.hourlyRate,
        status: brief.status,
        createdAt: brief.createdAt.toISOString(),
        published: brief.published,
        publicSlug: brief.publicSlug,
        template: brief.template,
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
