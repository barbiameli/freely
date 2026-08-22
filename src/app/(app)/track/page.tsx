import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { TrackDashboard } from "./track-dashboard";

export default async function TrackPage() {
  const user = await requireFullUser();
  const projects = await prisma.project.findMany({
    where: teamScopeWhere(user),
    include: { deliverables: true },
    orderBy: { createdAt: "desc" },
  });

  // Quotes that exist and are not being tracked, for the picker. "Add project"
  // used to take a title and a client name and make an empty shell: no
  // deliverables, no timeline, no price, so nothing to tick, break down, show a
  // client or invoice. Everything Track does needs a quote behind it.
  const untracked = await prisma.brief.findMany({
    where: { ...teamScopeWhere(user), status: { not: "TRACKED" } },
    select: { id: true, title: true, client: true, price: true, currency: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <TrackDashboard
      untracked={untracked.map((b) => ({
        id: b.id,
        title: b.title,
        client: b.client,
        price: b.price,
        currency: b.currency,
      }))}
      projects={projects.map((p) => ({
        id: p.id,
        title: p.title,
        client: p.client,
        status: p.status,
        price: p.price,
        hours: p.hours,
        currency: p.currency,
        deliverables: p.deliverables.map((d) => ({ id: d.id, done: d.done })),
      }))}
    />
  );
}
