import { prisma } from "@/lib/prisma";
import type { InvoiceLineItem } from "@/lib/invoice-pdf";

/**
 * Typed access to the Invoice table.
 *
 * The Invoice model is declared in schema.prisma, but the Prisma client
 * generated in this environment predates it and can't be regenerated here
 * (no network access to fetch the query engine). Rather than hand-editing
 * generated type definitions, which went badly, the cast is confined to this
 * one file and the row shape is written out explicitly below. Once a deploy
 * regenerates the client this becomes a redundant wrapper rather than
 * something load-bearing, and it can be deleted.
 *
 * Note what the row does NOT contain: bank details. They're typed per render
 * and never stored. See the Invoice model comment.
 */
export interface InvoiceRow {
  id: string;
  userId: string;
  number: number;
  issuedAt: Date;
  dueAt: Date;
  reference: string;
  clientName: string;
  clientCompany: string;
  clientWebsite: string;
  clientEmail: string;
  fromName: string;
  fromWebsite: string;
  fromEmail: string;
  fromAddress: string;
  fromTagline: string;
  lineItems: InvoiceLineItem[];
  /** Deliverables and hours, or one line and a total. */
  itemised: boolean;
  currency: string;
  taxRate: number;
  notes: string;
  branding: string;
  template: string;
  paid: boolean;
  paidAt: Date | null;
  projectId: string | null;
  briefId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type InvoiceCreateData = Omit<InvoiceRow, "id" | "createdAt" | "updatedAt" | "paidAt"> & {
  lineItems: unknown;
};

interface InvoiceDelegate {
  findFirst(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
  }): Promise<InvoiceRow | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
    take?: number;
  }): Promise<InvoiceRow[]>;
  create(args: { data: InvoiceCreateData }): Promise<InvoiceRow>;
  update(args: {
    where: { id: string };
    data: Partial<Omit<InvoiceRow, "id" | "userId">> & { lineItems?: unknown };
  }): Promise<InvoiceRow>;
  delete(args: { where: { id: string } }): Promise<InvoiceRow>;
  aggregate(args: {
    where: Record<string, unknown>;
    _max: { number: true };
  }): Promise<{ _max: { number: number | null } }>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

export const invoiceDb = (prisma as unknown as { invoice: InvoiceDelegate }).invoice;
