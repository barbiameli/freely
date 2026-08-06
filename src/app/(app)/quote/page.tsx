import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { QuoteWizard } from "./quote-wizard";

export default async function QuotePage() {
  const user = await requireFullUser();
  const scope = teamScopeWhere(user);
  const [projects, briefs] = await Promise.all([
    prisma.project.findMany({
      where: scope,
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.brief.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true },
    }),
  ]);

  return (
    <QuoteWizard
      projectTitles={projects.map((p) => p.title)}
      recentBriefs={briefs}
      userIndustry={user.industry}
      userCurrency={user.currency}
    />
  );
}
