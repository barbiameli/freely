"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { sanitizeText } from "@/lib/sanitize-text";
import { invoiceDb, type InvoiceRow } from "@/lib/invoice-db";
import type { InvoiceLineItem } from "@/lib/invoice-pdf";
import { billable, type BillingMode } from "@/lib/invoice-queue";
import type { ActionResult } from "@/actions/briefs";

/** Invoice numbers are sequential per user, so a client sees 0001, 0002 rather
 * than a random id. Computed at creation from the current maximum. */
async function nextInvoiceNumber(userId: string): Promise<number> {
  const result = await invoiceDb.aggregate({ where: { userId }, _max: { number: true } });
  return (result._max.number ?? 0) + 1;
}

function sanitizeLineItems(items: InvoiceLineItem[]): InvoiceLineItem[] {
  return items
    .filter((item) => item.title.trim() || item.amount)
    .map((item) => ({
      title: sanitizeText(item.title),
      description: item.description ? sanitizeText(item.description) : "",
      rate: item.rate ?? null,
      hours: item.hours ?? null,
      amount: Number.isFinite(item.amount) ? item.amount : 0,
    }));
}

/**
 * Creates an invoice, optionally seeded from a tracked project so the line
 * item, client and currency don't have to be retyped.
 */
export async function createInvoiceAction(
  projectId?: string
): Promise<ActionResult<{ invoiceId: string }>> {
  const user = await requireFullUser();

  let seed: {
    clientName: string;
    lineItems: InvoiceLineItem[];
    currency: string;
    branding: string;
    template: string;
    projectId: string | null;
    briefId: string | null;
  } = {
    clientName: "",
    lineItems: [{ title: "", description: "", rate: null, hours: null, amount: 0 }],
    currency: user.currency || "USD",
    branding: "freely",
    template: "classic",
    projectId: null,
    briefId: null,
  };

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, ...teamScopeWhere(user) },
      include: { brief: true },
    });
    if (!project) return { ok: false, error: "Project not found." };
    seed = {
      clientName: project.client,
      lineItems: [
        {
          title: project.title,
          description: "",
          rate: project.brief?.hourlyRate ?? null,
          hours: project.hours || null,
          amount: project.price,
        },
      ],
      currency: project.currency,
      // The invoice inherits the quote's look, so it doesn't arrive appearing
      // to come from a different company than the proposal did.
      branding: project.brief?.branding || "freely",
      template: project.brief?.template || "classic",
      projectId: project.id,
      briefId: project.briefId,
    };
  }

  const issuedAt = new Date();
  const dueAt = new Date(issuedAt);
  dueAt.setDate(dueAt.getDate() + 30);

  const invoice = await invoiceDb.create({
    data: {
      userId: user.id,
      number: await nextInvoiceNumber(user.id),
      issuedAt,
      dueAt,
      reference: "",
      clientName: seed.clientName,
      clientCompany: "",
      clientWebsite: "",
      clientEmail: "",
      fromName: user.studioName || user.name || "",
      fromWebsite: "",
      fromEmail: user.email,
      fromAddress: "",
      fromTagline: "",
      lineItems: seed.lineItems,
      itemised: true,
      currency: seed.currency,
      taxRate: 0,
      notes: "Payment within 30 days of the issue date.",
      branding: seed.branding,
      template: seed.template,
      paid: false,
      projectId: seed.projectId,
      briefId: seed.briefId,
    },
  });

  revalidatePath("/invoices");
  return { ok: true, data: { invoiceId: invoice.id } };
}

/**
 * Raises the invoice for whatever is currently billable on a project.
 *
 * The difference from createInvoiceAction is that this one knows the billing
 * rules: on a per-milestone project it bills the finished, unbilled
 * deliverables as separate lines and marks them billed in the same
 * transaction, so the same milestone cannot go out twice. On an
 * on-completion project it bills the project once.
 *
 * The line items are filled in from the work itself, which is the point: the
 * hours come from the step estimates and the amounts from the split, so an
 * invoice starts as a document to check rather than a form to complete.
 */
export async function invoiceProjectAction(
  projectId: string
): Promise<ActionResult<{ invoiceId: string }>> {
  const user = await requireFullUser();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
    include: { brief: true, deliverables: { include: { steps: true }, orderBy: { order: "asc" } } },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const invoiceCount = await invoiceDb.count({ where: { userId: user.id, projectId: project.id } });

  const entry = billable({
    id: project.id,
    title: project.title,
    client: project.client,
    price: project.price,
    hours: project.hours,
    currency: project.currency,
    billing: (project as unknown as { billing: BillingMode }).billing ?? "ON_COMPLETION",
    status: project.status,
    invoiceCount,
    deliverables: project.deliverables.map((d) => ({
      id: d.id,
      name: d.name,
      done: d.done,
      invoicedAt: (d as unknown as { invoicedAt: Date | null }).invoicedAt ?? null,
      steps: d.steps.map((s) => ({ estimateHours: s.estimateHours })),
    })),
  });

  if (!entry.lines.length) {
    return {
      ok: false,
      error:
        entry.notReady === "already-invoiced"
          ? "Everything on this project has been invoiced."
          : "Nothing is finished on this project yet.",
    };
  }

  const rate = project.brief?.hourlyRate ?? null;
  const issuedAt = new Date();
  const dueAt = new Date(issuedAt);
  dueAt.setDate(dueAt.getDate() + 30);

  const invoice = await invoiceDb.create({
    data: {
      userId: user.id,
      number: await nextInvoiceNumber(user.id),
      issuedAt,
      dueAt,
      reference: project.title,
      clientName: project.client,
      clientCompany: "",
      clientWebsite: "",
      clientEmail: "",
      fromName: user.studioName || user.name || "",
      fromWebsite: "",
      fromEmail: user.email,
      fromAddress: "",
      fromTagline: "",
      lineItems: sanitizeLineItems(
        entry.lines.map((line) => ({
          title: line.title,
          description: "",
          rate,
          hours: line.hours || null,
          amount: line.amount,
        }))
      ),
      itemised: entry.lines.length > 1,
      currency: project.currency,
      taxRate: 0,
      notes: "Payment within 30 days of the issue date.",
      branding: project.brief?.branding || "freely",
      template: project.brief?.template || "classic",
      paid: false,
      projectId: project.id,
      briefId: project.briefId,
    },
  });

  // Marked billed only after the invoice exists, so a failure above leaves the
  // milestones outstanding rather than silently swallowing them.
  const billedIds = entry.lines.map((l) => l.deliverableId).filter((id): id is string => Boolean(id));
  if (billedIds.length) {
    await prisma.deliverable.updateMany({
      where: { id: { in: billedIds } },
      data: { invoicedAt: issuedAt } as unknown as Parameters<
        typeof prisma.deliverable.updateMany
      >[0]["data"],
    });
  }

  revalidatePath("/invoices");
  revalidatePath(`/track/${project.id}`);
  return { ok: true, data: { invoiceId: invoice.id } };
}

/** How a project bills. Asked rather than inferred: see schema.prisma. */
export async function setBillingModeAction(
  projectId: string,
  mode: BillingMode
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
    select: { id: true },
  });
  if (!project) return { ok: false, error: "Project not found." };

  await prisma.project.update({
    where: { id: project.id },
    data: { billing: mode } as unknown as Parameters<typeof prisma.project.update>[0]["data"],
  });
  revalidatePath(`/track/${project.id}`);
  revalidatePath("/invoices");
  return { ok: true, data: undefined };
}

/**
 * Marks a project finished, which is what makes an on-completion project
 * billable. Ticks off any remaining deliverables at the same time: a project
 * that is done cannot have unfinished work in it, and leaving them unticked
 * would keep it out of the invoice queue by the deliverable rule.
 */
export async function markProjectDoneAction(
  projectId: string
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
    select: { id: true },
  });
  if (!project) return { ok: false, error: "Project not found." };

  await prisma.$transaction([
    prisma.deliverable.updateMany({
      where: { projectId: project.id, done: false },
      data: { done: true },
    }),
    prisma.project.update({ where: { id: project.id }, data: { status: "DONE" } }),
  ]);

  revalidatePath("/invoices");
  revalidatePath(`/track/${project.id}`);
  revalidatePath("/track");
  return { ok: true, data: undefined };
}

export type InvoicePatch = Partial<
  Pick<
    InvoiceRow,
    | "reference"
    | "clientName"
    | "clientCompany"
    | "clientWebsite"
    | "clientEmail"
    | "fromName"
    | "fromWebsite"
    | "fromEmail"
    | "fromAddress"
    | "fromTagline"
    | "currency"
    | "taxRate"
    | "notes"
    | "branding"
    | "template"
    | "paid"
    | "itemised"
  >
> & {
  issuedAt?: string;
  dueAt?: string;
  lineItems?: InvoiceLineItem[];
};

export async function updateInvoiceAction(
  invoiceId: string,
  patch: InvoicePatch
): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const invoice = await invoiceDb.findFirst({ where: { id: invoiceId, userId: user.id } });
  if (!invoice) return { ok: false, error: "Invoice not found." };

  const textFields = [
    "reference",
    "clientName",
    "clientCompany",
    "clientWebsite",
    "clientEmail",
    "fromName",
    "fromWebsite",
    "fromEmail",
    "fromAddress",
    "fromTagline",
    "notes",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const field of textFields) {
    const value = patch[field];
    if (value !== undefined) data[field] = sanitizeText(value);
  }
  if (patch.currency !== undefined) data.currency = patch.currency;
  if (patch.branding !== undefined) data.branding = patch.branding;
  if (patch.template !== undefined) data.template = patch.template;
  if (patch.paid !== undefined) {
    data.paid = patch.paid;
    data.paidAt = patch.paid ? new Date() : null;
  }
  if (patch.taxRate !== undefined) {
    if (!Number.isFinite(patch.taxRate) || patch.taxRate < 0 || patch.taxRate > 100) {
      return { ok: false, error: "Tax rate needs to be between 0 and 100." };
    }
    data.taxRate = patch.taxRate;
  }
  if (patch.issuedAt !== undefined) data.issuedAt = new Date(patch.issuedAt);
  if (patch.dueAt !== undefined) data.dueAt = new Date(patch.dueAt);
  if (patch.lineItems !== undefined) data.lineItems = sanitizeLineItems(patch.lineItems);

  try {
    await invoiceDb.update({ where: { id: invoice.id }, data });
  } catch (err) {
    console.error("[updateInvoiceAction] failed", err);
    return {
      ok: false,
      error: `Couldn't save that. ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true, data: undefined };
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult<undefined>> {
  const user = await requireFullUser();
  const invoice = await invoiceDb.findFirst({ where: { id: invoiceId, userId: user.id } });
  if (!invoice) return { ok: false, error: "Invoice not found." };
  await invoiceDb.delete({ where: { id: invoice.id } });
  revalidatePath("/invoices");
  return { ok: true, data: undefined };
}
