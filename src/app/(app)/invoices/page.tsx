import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { invoiceDb } from "@/lib/invoice-db";
import { invoiceQueue, type BillingMode, type QueueProject } from "@/lib/invoice-queue";
import { Topbar } from "@/components/topbar";
import { InvoicesView, type InvoiceRowView } from "./invoices-view";

export default async function InvoicesPage() {
  const user = await requireFullUser();

  const [invoices, projects] = await Promise.all([
    invoiceDb.findMany({ where: { userId: user.id }, orderBy: { number: "desc" } }),
    prisma.project.findMany({
      where: teamScopeWhere(user),
      include: { deliverables: { include: { steps: true }, orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // How many invoices exist per project, so the queue can tell an unbilled
  // project from one that has already been through.
  const invoicedProjectIds = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.projectId) continue;
    invoicedProjectIds.set(inv.projectId, (invoicedProjectIds.get(inv.projectId) ?? 0) + 1);
  }

  const queueProjects: QueueProject[] = projects.map((p) => ({
    id: p.id,
    title: p.title,
    client: p.client,
    price: p.price,
    hours: p.hours,
    currency: p.currency,
    billing: ((p as unknown as { billing?: BillingMode }).billing ?? "ON_COMPLETION") as BillingMode,
    status: p.status,
    invoiceCount: invoicedProjectIds.get(p.id) ?? 0,
    deliverables: p.deliverables.map((d) => ({
      id: d.id,
      name: d.name,
      done: d.done,
      invoicedAt: (d as unknown as { invoicedAt?: Date | null }).invoicedAt ?? null,
      steps: d.steps.map((s) => ({ estimateHours: s.estimateHours })),
    })),
  }));

  const queue = invoiceQueue(queueProjects).map((entry) => ({
    projectId: entry.project.id,
    title: entry.project.title,
    client: entry.project.client,
    currency: entry.project.currency,
    perMilestone: entry.project.billing === "PER_MILESTONE",
    lines: entry.lines.map((l) => ({ title: l.title, hours: l.hours, amount: l.amount })),
    total: entry.total,
    notReady: entry.notReady,
    doneCount: entry.project.deliverables.filter((d) => d.done).length,
    totalCount: entry.project.deliverables.length,
  }));

  const invoiceRows: InvoiceRowView[] = invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    clientName: inv.clientName,
    issuedAt: inv.issuedAt.toISOString(),
    dueAt: inv.dueAt.toISOString(),
    total: inv.lineItems.reduce((sum, i) => sum + i.amount, 0) * (1 + inv.taxRate / 100),
    currency: inv.currency,
    paid: inv.paid,
  }));

  return (
    <>
      <Topbar eyebrow="Invoices" />
      <InvoicesView
        invoices={invoiceRows}
        queue={queue}
        projects={projects.map((p) => ({ id: p.id, title: p.title, client: p.client }))}
      />
    </>
  );
}
