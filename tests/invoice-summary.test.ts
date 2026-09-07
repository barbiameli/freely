import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * A page that promises a download has one.
 *
 * "Invoice summary" said "Download this as a PDF and send it however you
 * normally invoice" above a card with nothing to press. The PDF route is keyed
 * on an Invoice record and this page summarises a project, so there was no
 * file to download and no way to make one from here: the only route to an
 * invoice was a queue on another screen. The one button on the page returned
 * null unless Stripe was connected, so for most people it was empty.
 */
const page = readFileSync("src/app/(app)/track/[projectId]/invoice/page.tsx", "utf8");
const button = readFileSync("src/app/(app)/track/[projectId]/invoice/raise-invoice.tsx", "utf8");
const en = readFileSync("src/lib/i18n/en.ts", "utf8");

describe("the invoice summary can do what it says", () => {
  it("offers a way to raise the invoice", () => {
    expect(page).toContain("RaiseInvoice");
    expect(button).toContain("invoiceProjectAction");
  });

  it("opens an existing invoice rather than raising a second one", () => {
    expect(page).toContain("prisma.invoice.findFirst");
    expect(button).toContain("existingInvoiceId");
  });

  it("does not depend on Stripe being connected", () => {
    // InvoiceActions returns null without it, which is right for a payment
    // button and was why this page had nothing on it at all.
    const start = page.indexOf("<RaiseInvoice");
    const element = page.slice(start, page.indexOf("/>", start));
    expect(element).not.toContain("stripeConfigured");
    // And it is rendered unconditionally, not behind that flag.
    expect(page).toContain("<RaiseInvoice projectId={project.id}");
  });

  it("stops promising a download before the invoice exists", () => {
    expect(en).not.toContain('pdfOnlyIntro: "Download this as a PDF');
  });
});

describe("the summary rows", () => {
  it("gives the timeline its own block", () => {
    // In a label-left value-right row it collapsed against its own label and
    // rendered as "TimelineAround 2 to 3 hours on the site and flow audit".
    expect(page).not.toContain('<Row label={t.publicQuote.timeline}');
    expect(page).not.toContain('label="Timeline"');
    expect(page).toContain("{project.timeline}</p>");
  });

  it("does not hardcode English labels on a translated page", () => {
    for (const label of [
      'label="Deliverables completed"',
      'label="Hours logged"',
      'label="Effective rate"',
      'label="Payment status"',
    ]) {
      expect(page).not.toContain(label);
    }
    expect(page).toContain("t.invoices.deliverablesCompleted");
  });
});

/**
 * An invoice can have no due date.
 *
 * dueAt was a required column, so clearing the box produced an Invalid Date
 * and Prisma refused the save with a message about types. Plenty of invoices
 * genuinely carry no date: a retainer, one settled on the spot, one whose
 * terms live in a contract rather than on the document.
 */
describe("the due date is optional", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const actions = readFileSync("src/actions/invoices.ts", "utf8");
  // The document itself, which is where the markup lives since the split.
  const pdf = readFileSync("src/lib/invoice-document.tsx", "utf8");
  const list = readFileSync("src/app/(app)/invoices/invoices-view.tsx", "utf8");

  it("is nullable in the schema", () => {
    const invoice = schema.slice(schema.indexOf("issuedAt  DateTime @default(now())"));
    expect(invoice.slice(0, 500)).toContain("dueAt     DateTime?");
  });

  it("treats an empty box as no date rather than an invalid one", () => {
    expect(actions).toContain("data.dueAt = patch.dueAt.trim() ? new Date(patch.dueAt) : null;");
  });

  it("prints no due row and no badge without one", () => {
    // It read "Due Invalid Date" in the corner of a document asking for money.
    expect(pdf).toContain("{invoice.dueAt ? (");
    expect(pdf).toContain("No badge without a date");
  });

  it("cannot be overdue without a date", () => {
    expect(list).toContain("inv.dueAt !== null");
  });
});

describe("the invoices list survives an invoice with no date", () => {
  const page = readFileSync("src/app/(app)/invoices/page.tsx", "utf8");
  const view = readFileSync("src/app/(app)/invoices/invoices-view.tsx", "utf8");

  it("does not call toISOString on nothing", () => {
    // The last reader still assuming a date. It threw for the whole page
    // rather than for the one invoice, so a single dateless invoice hid every
    // invoice behind an error screen.
    expect(page).not.toContain("dueAt: inv.dueAt.toISOString()");
    expect(page).toContain("inv.dueAt ? inv.dueAt.toISOString() : null");
  });

  it("shows one date rather than an invalid second one", () => {
    expect(view).toContain("{inv.dueAt ? `");
  });
});
