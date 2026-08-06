import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { ProjectDetail } from "./project-detail";

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const user = await requireFullUser();
  const scope = teamScopeWhere(user);
  const [project, allProjects] = await Promise.all([
    prisma.project.findFirst({
      where: { id: params.projectId, ...scope },
      include: { deliverables: { orderBy: { order: "asc" } } },
    }),
    prisma.project.findMany({
      where: scope,
      select: { id: true, title: true, client: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!project) notFound();

  return (
    <ProjectDetail
      project={{
        id: project.id,
        title: project.title,
        client: project.client,
        status: project.status,
        price: project.price,
        hours: project.hours,
        hoursLogged: project.hoursLogged,
        timeline: project.timeline,
        currency: project.currency,
        deliverables: project.deliverables.map((d) => ({ id: d.id, name: d.name, done: d.done })),
      }}
      projectList={allProjects}
    />
  );
}
