import { describe, it, expect } from "vitest";
import { buildGenerateUserPrompt, type QuoteDraftInput } from "@/lib/anthropic";
import { hasStrategyContent } from "@/lib/strategy";

const DRAFT: QuoteDraftInput = {
  sourceText: "Redesign the checkout for a small shop.",
  instructions: "",
  memoryProjectTitles: [],
  format: "PDF",
  hourlyRate: 60,
  rateUnit: "HOUR",
  currency: "GBP",
  paymentPlan: "SPLIT",
  upfrontPercent: 50,
  expertiseLevel: "Senior",
  includeStrategy: false,
  includeTimeline: false,
  includeSOW: false,
  includeTerms: false,
  includeRevisions: false,
  includeAvailability: false,
  includeAI: false,
};

describe("open questions", () => {
  /**
   * The checklist is the freelancer's, not the client's. It used to arrive
   * only when the Approach section was switched on, which meant that turning
   * every section off (now the default) produced a quote with nothing flagged.
   */
  it("asks for them even when the Approach section is off", () => {
    const prompt = buildGenerateUserPrompt(DRAFT);
    expect(prompt).toContain("openQuestions");
    expect(prompt).toContain("never shown to the client");
  });

  it("still asks for them when the Approach section is on", () => {
    const prompt = buildGenerateUserPrompt({ ...DRAFT, includeStrategy: true });
    expect(prompt).toContain("openQuestions");
  });

  it("says to leave the client-facing half empty when Approach is off", () => {
    const prompt = buildGenerateUserPrompt(DRAFT);
    expect(prompt).toContain('Set "goal" to an empty string');
  });
});

describe("hasStrategyContent", () => {
  it("is false for questions with no approach, so no empty heading is rendered", () => {
    expect(
      hasStrategyContent({ goal: "", findings: [], openQuestions: ["Who signs off?"] })
    ).toBe(false);
  });

  it("is true once there is a goal or a finding", () => {
    expect(hasStrategyContent({ goal: "Sell more", findings: [] })).toBe(true);
    expect(hasStrategyContent({ goal: "  ", findings: ["Checkout is four steps"] })).toBe(true);
  });

  it("is false for nothing at all", () => {
    expect(hasStrategyContent(null)).toBe(false);
    expect(hasStrategyContent(undefined)).toBe(false);
  });
});
