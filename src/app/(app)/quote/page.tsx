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

  // With no priced history, the model has nothing of the freelancer's own to
  // anchor to and has to research the market instead, which it can only do
  // well if it knows which market. The wizard asks for that only in this case.
  const pricedCount = await prisma.brief.count({
    where: { ...scope, price: { gt: 0 }, hours: { gt: 0 } },
  });

  return (
    <QuoteWizard
      recentBriefs={briefs}
      userIndustry={user.industry}
      userCurrency={user.currency}
      hasBrand={hasOwnBranding(user)}
      hasPricingHistory={pricedCount > 0}
      savedLocation={(user as unknown as { location: string | null }).location ?? ""}
    />
  );
}
