"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { sanitizeText } from "@/lib/sanitize-text";
import { invoiceDb, type InvoiceRow } from "@/lib/invoice-db";
import type { InvoiceLineItem } from "@/lib/invoice-pdf";
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
