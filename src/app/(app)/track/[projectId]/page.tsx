import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { deliverableDb, projectSchedule } from "@/lib/track-db";
import { invoiceDb } from "@/lib/invoice-db";
import type { BillingMode } from "@/lib/invoice-queue";
import { ProjectDetail } from "./project-detail";

// Breaking a deliverable down is a real model call, so give the route the
// same headroom the quote page has.
export const maxDuration = 60;

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const user = await requireFullUser();
  const scope = teamScopeWhere(user);

  const [project, allProjects] = await Promise.all([
    prisma.project.findFirst({ where: { id: params.projectId, ...scope } }),
    prisma.project.findMany({
      where: scope,
      select: { id: true, title: true, client: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!project) notFound();

  // Steps and flags come through the cast client, since the generated one in
  // this environment predates those tables. See lib/track-db.
  const deliverables = await deliverableDb.findMany({
    where: { projectId: project.id },
    orderBy: { order: "asc" },
    include: {
      steps: { orderBy: { order: "asc" } },
      flags: { orderBy: { createdAt: "asc" } },
    },
  });

  const schedule = projectSchedule(project);

  // Needed to tell an unbilled project from one already through, which is what
  // decides whether the billing panel offers an invoice.
  const invoiceCount = await invoiceDb.count({
    where: { userId: user.id, projectId: project.id },
  });

  return (
    <ProjectDetail
      invoiceCount={invoiceCount}
      billing={((project as unknown as { billing?: BillingMode }).billing ?? "ON_COMPLETION") as BillingMode}
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
        startDate: schedule.startDate?.toISOString() ?? null,
        dueDate: schedule.dueDate?.toISOString() ?? null,
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
            kind: f.kind,
            resolved: f.resolved,
          })),
        })),
      }}
      projectList={allProjects}
    />
  );
}
