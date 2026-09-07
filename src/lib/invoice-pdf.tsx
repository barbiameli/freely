import { renderToBuffer } from "@react-pdf/renderer";
import { invoiceDocument } from "@/lib/invoice-document";
import type { InvoicePdfData } from "@/lib/invoice-document";

export type {
  InvoiceLineItem,
  InvoicePaymentDetails,
  InvoicePdfData,
} from "@/lib/invoice-document";
export { invoiceDocument } from "@/lib/invoice-document";

/**
 * The invoice as a file.
 *
 * The document itself lives in lib/invoice-document, which the editor's live
 * preview also renders. One template, so what somebody sees while typing
 * cannot drift from the file their client receives.
 */
export async function renderInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(invoiceDocument(invoice));
}
