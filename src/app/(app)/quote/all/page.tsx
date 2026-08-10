import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { BriefCard, type BriefSummary } from "@/components/brief-card";

/** Every quote, with the send-to-Track action on each card. The carousel on
 * the wizard shows the recent ones; this is the full set. */
export default async function AllQuotesPage() {
  const user = await requireFullUser();
  const briefs = await prisma.brief.findMany({
    where: teamScopeWhere(user),
    orderBy: { createdAt: "desc" },
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

  const cards: BriefSummary[] = briefs.map((b) => ({
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
  }));

  const drafts = cards.filter((c) => c.status !== "TRACKED");

  return (
    <>
      <Topbar eyebrow="Quote - All quotes" />
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="font-display italic text-[30px] md:text-4xl text-coral m-0">
            Every quote you&apos;ve made.
          </h1>
          <p className="text-slate text-small mt-2">
            {cards.length} quote{cards.length === 1 ? "" : "s"}
            {drafts.length > 0 ? `, ${drafts.length} not yet in Track.` : "."}
          </p>
        </div>
        <Link href="/quote" className="text-small font-semibold text-violet">
          New quote
        </Link>
      </div>

      {cards.length === 0 ? (
        <Card>
          <div className="text-slate text-body">
            Nothing here yet.{" "}
            <Link href="/quote" className="text-violet font-semibold">
              Make your first quote
            </Link>
            .
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((brief) => (
            <BriefCard key={brief.id} brief={brief} />
          ))}
        </div>
      )}
    </>
  );
}
