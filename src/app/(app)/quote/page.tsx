import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { hasOwnBranding } from "@/lib/branding";
import { QuoteWizard } from "./quote-wizard";

// Brief generation (invoked from this page via generateBriefAction) can
// involve a large uploaded source document plus a real Claude call —
// sometimes with web search on top. Route segment config like this is the
// correct place for it: `export const maxDuration` inside the Server Action
// file itself isn't allowed ("use server" files may only export async
// functions), so it belongs on the page that invokes the action instead.
export const maxDuration = 60;

export default async function QuotePage() {
  const user = await requireFullUser();
  const scope = teamScopeWhere(user);
  const briefs = await prisma.brief.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true },
  });

  return (
    <QuoteWizard
      recentBriefs={briefs}
      userIndustry={user.industry}
      userCurrency={user.currency}
      hasBrand={hasOwnBranding(user)}
    />
  );
}
