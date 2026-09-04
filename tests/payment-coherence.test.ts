import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { paymentProblems } from "@/lib/payment-coherence";
import {
  basisDefinition,
  milestoneDefinition,
  paymentClause,
  revisionsClause,
  roundDefinition,
} from "@/lib/quote-definitions";

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

describe("the standard sentence is not added twice", () => {
  const words = {
    milestoneMeans: "A milestone is a named set of deliverables.",
  milestoneMeansShape: "A milestone marks a stage of the work, not a payment.",
    roundMeans: "A round is one consolidated set of feedback.",
    billedFixed: "This is a fixed total for the scope on this page.",
    billedTracked: "This is an estimate. You are billed for the hours actually worked.",
  };

  it("stays away when the paragraph already explains the basis", () => {
    // The freelancer's own words came first and said the same thing. A second
    // paragraph saying it differently is two answers to one question.
    const own =
      "All hours are tracked and billed at $50 per hour. The hours worked are invoiced on delivery.";
    expect(
      paymentClause(own, { hasMilestones: false, billing: "HOURLY_TRACKED", fixedPrice: false }, words)
    ).toBe(own);
  });

  it("still adds it when the paragraph leaves it unsaid", () => {
    const silent = "Payment is due within 14 days of the invoice.";
    expect(
      paymentClause(silent, { hasMilestones: false, billing: "HOURLY_TRACKED", fixedPrice: false }, words)
    ).toContain(words.billedTracked);
  });
});

describe("the definition agrees with the schedule", () => {
  const words = {
    milestoneMeans: "A milestone is a named set of deliverables with its own date and price. Each one is invoiced when it is delivered.",
    milestoneMeansShape: "A milestone marks a stage of the work, not a payment.",
    roundMeans: "A round is one consolidated set of feedback.",
    billedFixed: "This is a fixed total for the scope on this page.",
    billedTracked: "This is an estimate. You are billed for the hours actually worked.",
  };
  const terms = "Hours worked are invoiced at $50 per hour on completion of the project.";

  it("does not promise per-stage invoicing on a quote paid once", () => {
    // The real fault: "each one is invoiced when it is delivered" landing
    // three lines under "invoiced on completion of the project".
    const out = paymentClause(
      terms,
      { hasMilestones: true, milestonesBillable: false, billing: "HOURLY_TRACKED", fixedPrice: false },
      words
    );
    expect(out).toContain(words.milestoneMeansShape);
    expect(out).not.toContain("invoiced when it is delivered");
  });

  it("still defines the paying kind on a quote that bills by stage", () => {
    const out = paymentClause(
      "Each milestone is invoiced when it is delivered.",
      { hasMilestones: true, milestonesBillable: true, billing: "FIXED_TOTAL", fixedPrice: true },
      words
    );
    expect(out).toContain(words.milestoneMeans);
  });

  it("is editable and removable, not just visible", () => {
    // It is appended at render, so it was on the client's copy and in no
    // editable field. Showing it was the first fix and was not enough: it is
    // their document, so the wording is theirs, including deleting it.
    const view = readFileSync("src/app/(app)/quote/[briefId]/brief-view.tsx", "utf8");
    const line = readFileSync("src/components/quote/definition-line.tsx", "utf8");
    expect(view).toContain("DefinitionLine");
    expect(view).toContain('saveDefinition("milestone"');
    expect(view).toContain('saveDefinition("round"');
    expect(line).toContain("EditableBlock");
    expect(line).toContain("onSave(null)");
    expect(line).toContain("t.brief.definitionRestore");
  });

  it("says nothing when the freelancer removed it", () => {
    const words = {
      milestoneMeans: "billable definition",
      milestoneMeansShape: "shape definition",
      roundMeans: "round definition",
      billedFixed: "fixed",
      billedTracked: "tracked",
    };
    expect(milestoneDefinition({ milestone: null }, words, true)).toBe("");
    expect(roundDefinition({ round: null }, words)).toBe("");
    // And the clause does not append an empty line.
    const out = paymentClause(
      "Paid on delivery.",
      { hasMilestones: true, milestonesBillable: true, billing: "FIXED_TOTAL", fixedPrice: true, definition: "" },
      words
    );
    expect(out).toBe("Paid on delivery.");
    expect(revisionsClause("Two rounds.", words, "")).toBe("Two rounds.");
  });

  it("uses the freelancer's wording over the default", () => {
    const words = {
      milestoneMeans: "billable definition",
      milestoneMeansShape: "shape definition",
      roundMeans: "round definition",
      billedFixed: "fixed",
      billedTracked: "tracked",
    };
    expect(milestoneDefinition({ milestone: "Mine" }, words, true)).toBe("Mine");
    expect(milestoneDefinition({}, words, false)).toBe("shape definition");
  });
});

describe("the sentence about how the total works", () => {
  const words = {
    milestoneMeans: "billable definition",
    milestoneMeansShape: "shape definition",
    roundMeans: "round definition",
    billedFixed: "This is a fixed total for the scope on this page.",
    billedTracked:
      "This is an estimate. You are billed for the hours actually worked, at the rate above. I will tell you when tracked time reaches 80% of the estimate.",
  };

  it("stays away from a paragraph that already explains itself", () => {
    // The real one, which the old word list missed: it said the same thing in
    // words the list did not have, so the quote said it twice and the second
    // version promised a ceiling the first did not.
    const own =
      "Hours are tracked in Toggl and invoiced at $50 per hour based on actual time recorded. " +
      "Delivered work with no response after 10 business days counts as accepted.";
    const out = paymentClause(
      own,
      { hasMilestones: false, billing: "HOURLY_TRACKED", fixedPrice: false },
      words
    );
    expect(out).toBe(own);
  });

  it("can be reworded", () => {
    expect(basisDefinition({ basis: "Mine" }, words, "HOURLY_TRACKED")).toBe("Mine");
  });

  it("can be removed, and then nothing is appended", () => {
    expect(basisDefinition({ basis: null }, words, "HOURLY_TRACKED")).toBe("");
    const out = paymentClause(
      "Paid on delivery.",
      { hasMilestones: false, billing: "HOURLY_TRACKED", fixedPrice: false, basis: "" },
      words
    );
    expect(out).toBe("Paid on delivery.");
  });

  it("is reachable from the editor", () => {
    const view = readFileSync("src/app/(app)/quote/[briefId]/brief-view.tsx", "utf8");
    expect(view).toContain('saveDefinition("basis"');
    expect(view).toContain("appended.basis");
  });
});
