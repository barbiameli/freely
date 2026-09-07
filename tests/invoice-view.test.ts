import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * An invoice is a document, so it is shown as one while it is written.
 *
 * The editor was a single column of cards ending in a Download button, so the
 * only way to find out what an invoice looked like was to build the file and
 * open it. The layout is most of what an invoice says, and it asks somebody
 * for money, so it is worth seeing before it goes rather than after.
 */
const editor = readFileSync("src/app/(app)/invoices/[invoiceId]/invoice-editor.tsx", "utf8");
const preview = readFileSync("src/components/invoice/live-preview.tsx", "utf8");
const route = readFileSync("src/app/api/invoices/[id]/pdf/route.ts", "utf8");
const actions = readFileSync("src/actions/invoices.ts", "utf8");
const pdf = readFileSync("src/lib/invoice-pdf.tsx", "utf8");

describe("the live preview", () => {
  it("shows the real document, not a lookalike", () => {
    // Two templates agree until the day one is edited, and a preview that
    // lies about the file a client receives is worse than no preview.
    expect(preview).toContain("/pdf");
    expect(preview).not.toContain("<table");
    expect(pdf).toContain("renderToBuffer(invoiceDocument(invoice))");
  });

  it("keeps one mapping from form to document", () => {
    // Rendering in the browser meant a second copy of that mapping on the
    // client, which is the same two-things-describing-one-fact problem.
    expect(route).toContain("draft?: Partial<");
    expect(preview).toContain("draft");
  });

  it("draws what is being typed, not what was last saved", () => {
    expect(route).toContain("const draft = body.draft ?? {};");
    expect(editor).toContain("<LivePreview");
  });

  it("waits for a pause rather than rendering every keystroke", () => {
    expect(preview).toContain("700");
  });

  it("does not blink white between edits", () => {
    // The old object URL is released only once the new one is in hand.
    expect(preview).toContain("if (previous.current) URL.revokeObjectURL(previous.current);");
  });

  it("lets a preview exist before payment details do", () => {
    // A download without them is a document nobody can pay. A preview without
    // them is somebody halfway through the form.
    expect(route).toContain("!paymentBlock && !body.preview");
  });
});

describe("the reference", () => {
  it("defaults to the invoice number", () => {
    // It was blank, so either the invoice went out with no reference or
    // somebody typed the number they were already looking at.
    expect(actions).toContain("function referenceFor(number: number)");
    expect(actions).not.toContain('reference: "",');
  });

  it("is not the project title", () => {
    // A reference is what a client types into a bank transfer.
    expect(actions).not.toContain("reference: project.title,");
  });
});

describe("the editor's shape", () => {
  it("is two columns", () => {
    expect(editor).toContain("lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
  });

  it("keeps the document in view while the form scrolls", () => {
    expect(editor).toContain("lg:sticky lg:top-5");
  });
});
