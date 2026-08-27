import { describe, it, expect } from "vitest";
import {
  buildGenerateUserPrompt,
  buildRefineUserPrompt,
  type QuoteDraftInput,
  type GeneratedBrief,
} from "@/lib/anthropic";
import { describeRow, type QuoteSetup, type SetupWords } from "@/lib/quote-defaults";

const DRAFT: QuoteDraftInput = {
  sourceText: "A rebrand for a coffee roaster.",
  instructions: "",
  memoryProjectTitles: [],
  format: "PDF",
  hourlyRate: 65,
  rateUnit: "HOUR",
  currency: "GBP",
  paymentPlan: "SPLIT",
  upfrontPercent: 50,
  expertiseLevel: "Senior",
  includeStrategy: false,
  includeTimeline: false,
  includeSOW: true,
  includeTerms: false,
  includeRevisions: false,
  includeAvailability: false,
  includeAI: false,
};

/**
 * The payment plan has to reach the call that writes the sentence.
 *
 * The quote is written in two halves at once, and paymentTerms is written by
 * the second one. The plan was only ever sent with the first, so the half that
 * wrote the sentence had never been told which plan was chosen, wrote
 * something generic, and then overwrote the correct version at the merge.
 * Changing the split changed nothing on the finished quote.
 */
describe("the payment plan reaches the half that writes the terms", () => {
  it("sends the split to the extras call", () => {
    const extras = buildGenerateUserPrompt(DRAFT, [], undefined, "extras");
    expect(extras).toContain("50% is due before the work starts");
  });

  it("sends a changed split, rather than the usual one", () => {
    const extras = buildGenerateUserPrompt(
      { ...DRAFT, upfrontPercent: 30 },
      [],
      undefined,
      "extras"
    );
    expect(extras).toContain("30% is due before the work starts");
    expect(extras).not.toContain("50% is due");
  });

  it("does not have the core half write the terms as well", () => {
    const core = buildGenerateUserPrompt(DRAFT, [], undefined, "core");
    expect(core).not.toContain('Write "paymentTerms"');
  });

  it("still writes them when the whole quote is one call", () => {
    const all = buildGenerateUserPrompt(DRAFT, [], undefined, "all");
    expect(all).toContain('Write "paymentTerms"');
  });

  it("carries the new all-on-delivery plan", () => {
    const extras = buildGenerateUserPrompt(
      { ...DRAFT, paymentPlan: "ON_DELIVERY" },
      [],
      undefined,
      "extras"
    );
    expect(extras).toContain("Nothing is due up front");
    expect(extras).toContain("invoiced on delivery");
  });
});

describe("a section you wrote is a section you get", () => {
  /**
   * With the sections left to the model, every instruction was prefixed with
   * "only if this quote needs it", including the ones the freelancer had
   * filled in themselves. Somebody typed their revisions policy and the model
   * decided the quote did not need one.
   */
  const choosing: QuoteDraftInput = {
    ...DRAFT,
    includeSOW: false,
    chooseSections: true,
    sectionNotes: { revisions: "Two rounds at wireframe, one at visuals." },
  };

  it("makes a section with a note non-optional", () => {
    const prompt = buildGenerateUserPrompt(choosing, [], undefined, "extras");
    expect(prompt).toContain("because the freelancer wrote it");
    expect(prompt).toContain("Two rounds at wireframe");
  });

  it("leaves the sections with no note optional", () => {
    const prompt = buildGenerateUserPrompt(choosing, [], undefined, "extras");
    expect(prompt).toContain("Only if this quote needs it:");
  });
});

describe("refining carries the sections both ways", () => {
  const current = {
    title: "Rebrand",
    client: "A roaster",
    scope: "Scope",
    deliverables: ["One"],
    timeline: "Six weeks",
    price: 6000,
    hours: 92,
    paymentTerms: "50% up front, 50% on delivery.",
    revisions: "Two rounds.",
  } as unknown as GeneratedBrief;

  it("shows the model the terms it is being asked to change", () => {
    const prompt = buildRefineUserPrompt(current, "make it 30% up front");
    expect(prompt).toContain("50% up front, 50% on delivery.");
  });

  it("asks for the whole quote back, sections included", () => {
    const prompt = buildRefineUserPrompt(current, "make it 30% up front");
    expect(prompt).toContain("paymentTerms");
    expect(prompt).toContain("comes back exactly as it was");
  });
});

const WORDS: SetupWords = {
  perHour: "per hour",
  perDay: "per day",
  fixed: "fixed",
  upfrontAll: "All upfront",
  onDelivery: "All on delivery",
  splitTemplate: "{n}% upfront, rest on delivery",
  byMilestone: "At each milestone",
  and: "and",
  nothingYet: "Not set",
  sectionsNone: "Freely picks what fits",
  sectionNames: {
    includeStrategy: "Strategy",
    includeTimeline: "Timeline",
    includeSOW: "Statement of Work",
    includeTerms: "Terms",
    includeRevisions: "Revisions",
    includeAvailability: "Availability",
    includeAI: "AI use",
  },
  formats: { HTML: "Page", PDF: "PDF", Figma: "Figma" },
  templates: { classic: "Classic", editorial: "Editorial", minimal: "Minimal" },
  brandings: { freely: "Freely", own: "Yours", "mono-light": "Light", "mono-dark": "Dark" },
};

describe("the setup row reads the new plan back", () => {
  it("says all on delivery rather than falling through to the split", () => {
    const setup = { paymentPlan: "ON_DELIVERY", upfrontPercent: 50 } as QuoteSetup;
    expect(describeRow("payment", setup, WORDS, "£")).toBe("All on delivery");
  });
});
