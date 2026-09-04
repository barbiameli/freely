import { describe, it, expect } from "vitest";
import { paymentProblems } from "@/lib/payment-coherence";

const tracked = {
  billing: "HOURLY_TRACKED" as const,
  milestonesBillable: false,
  fixedPrice: false,
};

describe("a payment paragraph that argues with itself", () => {
  // The paragraph that went out to a real client, near enough word for word.
  const real =
    "All hours are tracked and billed at $50 per hour, with a ceiling of $650 (13 hours). " +
    "If the project comes in under 13 hours, you pay only for the hours worked. " +
    "The full amount is invoiced on delivery of the final approved Figma files, with payment due on receipt. " +
    "If a delivered milestone receives no response within 10 business days of delivery, it is treated as " +
    "accepted, invoiced for the hours worked to that point, and the next milestone starts.";

  it("catches all three faults in the one that shipped", () => {
    expect(paymentProblems(real, tracked).sort()).toEqual(
      ["bothAmounts", "ceilingOnEstimate", "milestoneWithoutMilestones"].sort()
    );
  });

  it("stays quiet on a coherent tracked-hours paragraph", () => {
    const good =
      "All hours are tracked and billed at $50 per hour. The hours worked are invoiced on delivery " +
      "of the final approved Figma files, with payment due within 14 days.";
    expect(paymentProblems(good, tracked)).toEqual([]);
  });

  it("lets a fixed total say the full amount is due", () => {
    // On a fixed price the whole amount genuinely is what is owed.
    const fixed = "The full amount is invoiced on delivery, with payment due within 14 days.";
    expect(
      paymentProblems(fixed, { billing: "FIXED_TOTAL", milestonesBillable: false, fixedPrice: true })
    ).toEqual([]);
  });

  it("allows milestone invoicing when the stages are payment points", () => {
    const perStage = "Each milestone is invoiced when it is delivered.";
    expect(
      paymentProblems(perStage, { ...tracked, milestonesBillable: true })
    ).not.toContain("milestoneWithoutMilestones");
  });

  it("says nothing about an empty section", () => {
    expect(paymentProblems("", tracked)).toEqual([]);
    expect(paymentProblems(null, tracked)).toEqual([]);
  });

  it("reads Spanish too", () => {
    const es =
      "Todas las horas se facturan a 50 $ por hora, con un tope de 650 $. " +
      "Pagas solo las horas realmente trabajadas. El importe total se factura a la entrega.";
    expect(paymentProblems(es, tracked)).toContain("ceilingOnEstimate");
    expect(paymentProblems(es, tracked)).toContain("bothAmounts");
  });
});
