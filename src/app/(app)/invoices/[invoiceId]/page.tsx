import { notFound } from "next/navigation";
import { requireFullUser } from "@/lib/session";
import { invoiceDb } from "@/lib/invoice-db";
import { hasOwnBranding } from "@/lib/branding";
import { InvoiceEditor } from "./invoice-editor";

export default async function InvoicePage({ params }: { params: { invoiceId: string } }) {
  const user = await requireFullUser();
  const invoice = await invoiceDb.findFirst({
    where: { id: params.invoiceId, userId: user.id },
  });
  if (!invoice) notFound();

  return (
    <InvoiceEditor
      invoice={{
        id: invoice.id,
        number: invoice.number,
        issuedAt: invoice.issuedAt.toISOString().slice(0, 10),
        dueAt: invoice.dueAt.toISOString().slice(0, 10),
        reference: invoice.reference,
        clientName: invoice.clientName,
        clientCompany: invoice.clientCompany,
        clientWebsite: invoice.clientWebsite,
        clientEmail: invoice.clientEmail,
        fromName: invoice.fromName,
        fromTagline: invoice.fromTagline,
        fromWebsite: invoice.fromWebsite,
        fromEmail: invoice.fromEmail,
        fromAddress: invoice.fromAddress,
        lineItems: invoice.lineItems,
        itemised: invoice.itemised,
        currency: invoice.currency,
        taxRate: invoice.taxRate,
        notes: invoice.notes,
        branding: invoice.branding,
        paid: invoice.paid,
      }}
      hasBrand={hasOwnBranding(user)}
    />
  );
}
