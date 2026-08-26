import { describe, it, expect } from "vitest";
import {
  buildGenerateUserPrompt,
  strategySchema,
  wantsExtras,
  type QuoteDraftInput,
} from "@/lib/anthropic";
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

describe("the strategy object with no Approach in it", () => {
  /**
   * The schema used to demand a goal and at least one finding. With the
   * Approach section off, the model is told to send neither, so the whole
   * quote was rejected over the half nobody asked for.
   */
  it("accepts questions with an empty goal and no findings", () => {
    const parsed = strategySchema.safeParse({
      goal: "",
      findings: [],
      openQuestions: ["Who signs off on the copy?"],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.openQuestions).toHaveLength(1);
  });

  it("fills both halves in when they are missing entirely", () => {
    const parsed = strategySchema.parse({ openQuestions: [] });
    expect(parsed.goal).toBe("");
    expect(parsed.findings).toEqual([]);
  });

  it("still takes a full Approach", () => {
    const parsed = strategySchema.parse({
      goal: "Sell more without discounting",
      findings: ["Checkout is four steps"],
      openQuestions: [],
    });
    expect(parsed.findings).toHaveLength(1);
  });
});

describe("when nobody picked any sections", () => {
  /**
   * All sections are off by default, so a first quote from somebody who did
   * not go through the list would be scope, price and nothing else. The model
   * is told to choose instead, and what it writes is recorded as the quote's
   * sections.
   */
  const choosing = { ...DRAFT, chooseSections: true };

  it("hands the choice to the model", () => {
    const prompt = buildGenerateUserPrompt(choosing);
    expect(prompt).toContain("choose them yourself");
    expect(prompt).toContain("never include a section you would have to invent facts to fill");
  });

  it("still describes every section, so a chosen one has a shape to follow", () => {
    const prompt = buildGenerateUserPrompt(choosing);
    for (const key of ['"terms"', '"revisions"', '"aiUsage"', '"paymentTerms"']) {
      expect(prompt).toContain(key);
    }
    expect(prompt).toContain("Only if this quote needs it:");
  });

  it("leaves the timeline shape open", () => {
    const prompt = buildGenerateUserPrompt(choosing);
    expect(prompt).toContain("You are choosing whether Timeline is its own section");
  });

  it("makes the second call happen, since everything is on the table", () => {
    expect(wantsExtras(choosing)).toBe(true);
    expect(wantsExtras(DRAFT)).toBe(false);
  });

  it("says nothing about choosing when the sections were ticked", () => {
    const prompt = buildGenerateUserPrompt({ ...DRAFT, includeTerms: true });
    expect(prompt).not.toContain("choose them yourself");
    expect(prompt).not.toContain("Only if this quote needs it:");
  });
});
