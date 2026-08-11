import { describe, it, expect } from "vitest";
import { detectBillingMode, milestoneProgress } from "@/lib/billing-mode";

describe("detectBillingMode", () => {
  it("reads the freelancer's own payment terms", () => {
    expect(
      detectBillingMode({
        paymentTerms: "40% up front, the rest invoiced at each milestone.",
      })
    ).toEqual({ mode: "PER_MILESTONE", from: "paymentTerms" });
  });

  it("catches the wizard preset in the instructions", () => {
    expect(
      detectBillingMode({
        instructions: "Split it into milestones with a payment at each",
      })
    ).toEqual({ mode: "PER_MILESTONE", from: "instructions" });
  });

  it("prefers the payment terms over the instructions", () => {
    const detection = detectBillingMode({
      paymentTerms: "Payment in three payments, one per phase.",
      instructions: "keep it simple",
    });
    expect(detection.from).toBe("paymentTerms");
  });

  it("bills on completion when nothing says otherwise", () => {
    expect(
      detectBillingMode({
        paymentTerms: "50% before work starts, 50% on final delivery.",
      })
    ).toEqual({ mode: "ON_COMPLETION", from: null });
  });

  it("bills on completion with nothing to go on", () => {
    expect(detectBillingMode({}).mode).toBe("ON_COMPLETION");
    expect(detectBillingMode({ paymentTerms: null, instructions: "" }).mode).toBe("ON_COMPLETION");
  });

  it("reads Spanish, accented or not", () => {
    // The accented spellings match on the unaccented part of the phrase, so
    // these pass either way. They are here because the Spanish is what a
    // Spanish-speaking freelancer will actually have written.
    expect(detectBillingMode({ paymentTerms: "Un pago por cada hito." }).mode).toBe(
      "PER_MILESTONE"
    );
    expect(detectBillingMode({ paymentTerms: "Facturación por fases." }).mode).toBe(
      "PER_MILESTONE"
    );
    expect(detectBillingMode({ paymentTerms: "Facturacion por fases." }).mode).toBe(
      "PER_MILESTONE"
    );
    expect(detectBillingMode({ paymentTerms: "En tres pagos." }).mode).toBe("PER_MILESTONE");
  });

  it("does not treat a staged timeline as milestone billing", () => {
    // Every project has stages. Stages are how work is organised, not how it is
    // billed, so this must stay on completion.
    expect(
      detectBillingMode({
        paymentTerms: "50% up front, 50% on delivery.",
        instructions: "Week 1-2 discovery, Week 3-4 design, Week 5 handover",
      }).mode
    ).toBe("ON_COMPLETION");
  });

  it("is not fooled by the word 'phase' on its own", () => {
    expect(
      detectBillingMode({ paymentTerms: "The design phase starts once the audit is signed off." })
        .mode
    ).toBe("ON_COMPLETION");
  });
});

describe("milestoneProgress", () => {
  it("points at the one in hand", () => {
    expect(milestoneProgress([{ done: true }, { done: true }, { done: false }, { done: false }])).toEqual(
      { current: 3, total: 4 }
    );
  });

  it("starts at the first", () => {
    expect(milestoneProgress([{ done: false }, { done: false }])).toEqual({ current: 1, total: 2 });
  });

  it("stops at the last rather than running past it", () => {
    expect(milestoneProgress([{ done: true }, { done: true }])).toEqual({ current: 2, total: 2 });
  });

  it("handles a project with no deliverables", () => {
    expect(milestoneProgress([])).toEqual({ current: 0, total: 0 });
  });
});
