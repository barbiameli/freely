import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { deliverableDb } from "@/lib/track-db";
import { DiaryView } from "./diary-view";

// Breaking a deliverable down from the diary is the same model call as in
// Track, so the route needs the same headroom.
export const maxDuration = 60;

export default async function DiaryProjectPage({ params }: { params: { projectId: string } }) {
  const user = await requireFullUser();
  const scope = teamScopeWhere(user);

  const [project, allProjects] = await Promise.all([
    prisma.project.findFirst({
      where: { id: params.projectId, ...scope },
      include: { diaryEntries: { orderBy: { date: "desc" } } },
    }),
    prisma.project.findMany({
      where: scope,
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!project) notFound();

  // Through the cast client, so the steps and flags come with it: the diary
  // shows the same deliverables as Track rather than a name-only copy.
  const deliverables = await deliverableDb.findMany({
    where: { projectId: project.id },
    orderBy: { order: "asc" },
    include: {
      steps: { orderBy: { order: "asc" } },
      flags: { orderBy: { createdAt: "asc" } },
    },
  });

  return (
    <DiaryView
      allProjects={allProjects}
      project={{
        id: project.id,
        title: project.title,
        client: project.client,
        status: project.status,
        published: project.published,
        publicSlug: project.publicSlug,
        deliverables: deliverables.map((d) => ({
          id: d.id,
          name: d.name,
          done: d.done,
          dueAt: d.dueAt?.toISOString() ?? null,
          summary: d.summary,
          brokenDown: Boolean(d.brokenDownAt),
          invoicedAt: d.invoicedAt?.toISOString() ?? null,
          steps: (d.steps ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            done: s.done,
            estimateHours: s.estimateHours,
          })),
          flags: (d.flags ?? []).map((f) => ({
            id: f.id,
            question: f.question,
            reason: f.reason,
            kind: f.kind as "BLOCKER" | "ASSUMPTION" | "WORTH_ASKING",
            resolved: f.resolved,
          })),
        })),
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
