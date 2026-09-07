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

  let body: {
    paymentBlock?: string;
    paymentNote?: string;
    /**
     * The invoice as it stands in the editor, unsaved.
     *
     * Sent so the live preview draws what is being typed rather than what was
     * last saved. Optional: a plain download sends nothing and gets the
     * stored row, which is the version that matters once it goes out.
     *
     * Deliberately routed through here rather than rendered in the browser.
     * The alternative was a second copy of this mapping on the client, and
     * two things describing one document is how a preview comes to disagree
     * with the file a client receives.
     */
    draft?: Partial<{
      issuedAt: string;
      dueAt: string;
      reference: string;
      clientName: string;
      clientCompany: string;
      clientWebsite: string;
      clientEmail: string;
      fromName: string;
      fromTagline: string;
      fromWebsite: string;
      fromEmail: string;
      fromAddress: string;
      lineItems: unknown;
      itemised: boolean;
      currency: string;
      taxRate: number;
      notes: string;
      branding: string;
    }>;
    /** A preview is allowed to have no payment details yet. */
    preview?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const paymentBlock = sanitizeText(body.paymentBlock || "").trim();
  // A download without payment details is a document nobody can pay. A
  // preview without them is somebody halfway through filling the form.
  if (!paymentBlock && !body.preview) {
    return NextResponse.json(
      { error: "Add your payment details before downloading, they aren't stored anywhere." },
      { status: 400 }
    );
  }

  // The draft where there is one, the stored row otherwise.
  const draft = body.draft ?? {};
  const field = <K extends keyof typeof invoice>(key: K, override: unknown) =>
    override === undefined ? invoice[key] : (override as (typeof invoice)[K]);

  const resolved = resolveBrand(
    typeof draft.branding === "string" ? draft.branding : invoice.branding,
    user
  );

  const pdf = await renderInvoicePdf({
    // The client's language, not the freelancer's interface. An invoice is
    // read by whoever pays it.
    language: resolveQuoteLocale(user),
    number: invoice.number,
    issuedAt: draft.issuedAt || invoice.issuedAt.toISOString(),
    dueAt: draft.dueAt ?? (invoice.dueAt ? invoice.dueAt.toISOString() : ""),
    reference: field("reference", draft.reference),
    clientName: field("clientName", draft.clientName),
    clientCompany: field("clientCompany", draft.clientCompany),
    clientWebsite: field("clientWebsite", draft.clientWebsite),
    clientEmail: field("clientEmail", draft.clientEmail),
    fromName: field("fromName", draft.fromName),
    fromTagline: field("fromTagline", draft.fromTagline),
    fromWebsite: field("fromWebsite", draft.fromWebsite),
    fromEmail: field("fromEmail", draft.fromEmail),
    fromAddress: field("fromAddress", draft.fromAddress),
    lineItems: (draft.lineItems ?? invoice.lineItems) as typeof invoice.lineItems,
    itemised: field("itemised", draft.itemised),
    currency: field("currency", draft.currency),
    taxRate: field("taxRate", draft.taxRate),
    notes: field("notes", draft.notes),
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
