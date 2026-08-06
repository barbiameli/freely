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

  return (
    <TrackDashboard
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
