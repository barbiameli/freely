import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { invoiceDb } from "@/lib/invoice-db";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { resolveBrand } from "@/lib/branding";
import { sanitizeText } from "@/lib/sanitize-text";
import { resolveQuoteLocale } from "@/lib/i18n/types";

export const runtime = "nodejs";

/**
 * Renders an invoice to PDF and streams it back.
 *
 * POST rather than GET, deliberately. Payment details arrive in the request
 * body: in a query string they would be written into server access logs,
 * browser history and any proxy in between, which is exactly the exposure this
 * whole design is meant to avoid.
 *
 * Nothing here is persisted. The PDF is generated per request and returned; it
 * is never written to storage and the payment details are never saved. That is
 * the reason invoices can't be emailed from Freely without revisiting this
 * decision.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return new NextResponse("Unauthorized", { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const invoice = await invoiceDb.findFirst({ where: { id: params.id, userId: user.id } });
  if (!invoice) return new NextResponse("Not found", { status: 404 });

  let body: { paymentBlock?: string; paymentNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const paymentBlock = sanitizeText(body.paymentBlock || "").trim();
  if (!paymentBlock) {
    return NextResponse.json(
      { error: "Add your payment details before downloading, they aren't stored anywhere." },
      { status: 400 }
    );
  }

  const resolved = resolveBrand(invoice.branding, user);

  const pdf = await renderInvoicePdf({
    // The client's language, not the freelancer's interface. An invoice is
    // read by whoever pays it.
    language: resolveQuoteLocale(user),
    number: invoice.number,
    issuedAt: invoice.issuedAt.toISOString(),
    dueAt: invoice.dueAt.toISOString(),
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
    payment: {
      block: paymentBlock,
      note: sanitizeText(body.paymentNote || "").trim(),
    },
    primary: resolved.primary,
    accent: resolved.accent,
    logoDataUrl: resolved.logoDataUrl,
    mono: resolved.mono,
    dark: resolved.dark,
  });

  const clientSlug = (invoice.clientName || "client").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const fileName = `invoice-${String(invoice.number).padStart(4, "0")}-${clientSlug}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      // Belt and braces: a document containing payment details should not sit
      // in any shared cache.
      "Cache-Control": "no-store, private",
    },
  });
}
