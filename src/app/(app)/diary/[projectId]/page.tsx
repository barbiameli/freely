import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { DiaryView } from "./diary-view";

export default async function DiaryProjectPage({
  params,
}: {
  params: { projectId: string };
}) {
  const user = await requireFullUser();
  const scope = teamScopeWhere(user);
  const [project, allProjects] = await Promise.all([
    prisma.project.findFirst({
      where: { id: params.projectId, ...scope },
      include: {
        deliverables: { orderBy: { order: "asc" } },
        diaryEntries: { orderBy: { date: "desc" } },
      },
    }),
    prisma.project.findMany({
      where: scope,
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!project) notFound();

  return (
    <DiaryView
      allProjects={allProjects}
      project={{
        id: project.id,
        title: project.title,
        status: project.status,
        timeline: project.timeline,
        published: project.published,
        publicSlug: project.publicSlug,
        deliverables: project.deliverables.map((d) => ({ id: d.id, name: d.name, done: d.done })),
        diaryEntries: project.diaryEntries.map((e) => ({
          id: e.id,
          date: e.date.toISOString(),
          title: e.title,
          body: e.body,
        })),
      }}
    />
  );
}
