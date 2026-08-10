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
    take: 12,
    select: {
      id: true,
      title: true,
      client: true,
      price: true,
      hours: true,
      currency: true,
      deliverables: true,
      status: true,
      published: true,
      createdAt: true,
    },
  });

  return (
    <QuoteWizard
      recentBriefs={briefs.map((b) => ({
        id: b.id,
        title: b.title,
        client: b.client,
        price: b.price,
        hours: b.hours,
        currency: b.currency,
        deliverables: (b.deliverables as string[]) ?? [],
        status: b.status as "DRAFT" | "TRACKED",
        published: b.published,
        createdAt: b.createdAt.toISOString(),
      }))}
      userCurrency={user.currency}
      hasBrand={hasOwnBranding(user)}
      savedLocation={(user as unknown as { location: string | null }).location ?? ""}
      savedRate={(user as unknown as { defaultRate: number | null }).defaultRate ?? 0}
      savedRateUnit={
        (user as unknown as { defaultRateUnit: string | null }).defaultRateUnit ?? "HOUR"
      }
    />
  );
}
