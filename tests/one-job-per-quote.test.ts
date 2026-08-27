import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGenerateUserPrompt, type QuoteDraftInput } from "@/lib/anthropic";
import { projectPresetKeys } from "@/lib/quote-prompts";

/**
 * A quote is for one kind of work, even when the freelancer does three.
 *
 * Naming more than one discipline used to change a single line of the prompt.
 * The price still anchored on a blend of every past quote, the wizard offered
 * examples from one discipline only, and nothing knew which kind of work the
 * job in front of it actually was.
 */
const DRAFT: QuoteDraftInput = {
  sourceText: "Build the checkout flow in Next.js.",
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
  includeTimeline: true,
  includeSOW: false,
  includeTerms: false,
  includeRevisions: false,
  includeAvailability: false,
  includeAI: false,
};

const TWO = [
  { key: "ux-designer", label: "UX designer" },
  { key: "frontend-developer", label: "Frontend developer" },
];

describe("naming the discipline of a job", () => {
  it("asks only when there is more than one to choose from", () => {
    expect(buildGenerateUserPrompt(DRAFT)).not.toContain("does more than one kind of work");
    expect(buildGenerateUserPrompt({ ...DRAFT, disciplines: TWO })).toContain(
      "does more than one kind of work"
    );
  });

  it("gives the model the keys, so the answer can be stored and compared", () => {
    const prompt = buildGenerateUserPrompt({ ...DRAFT, disciplines: TWO });
    expect(prompt).toContain("ux-designer (UX designer)");
    expect(prompt).toContain("frontend-developer (Frontend developer)");
  });

  it("judges by what the client is buying rather than by word counts", () => {
    const prompt = buildGenerateUserPrompt({ ...DRAFT, disciplines: TWO });
    expect(prompt).toContain("not by which words appear most");
  });

  it("asks for the whole quote to be written as that kind of work", () => {
    const prompt = buildGenerateUserPrompt({ ...DRAFT, disciplines: TWO });
    expect(prompt).toContain("Write the whole quote as that kind of work");
  });

  it("names it in the schema, or the model has no field to put it in", () => {
    const anthropic = readFileSync("src/lib/anthropic.ts", "utf8");
    expect(anthropic).toContain('"discipline": string');
    expect(anthropic).toContain("discipline: z.string().optional()");
  });
});

describe("what the price anchors on", () => {
  const history = [
    {
      title: "A design sprint",
      price: 2000,
      hours: 30,
      impliedHourlyRate: 66,
      outcome: "WON" as const,
      discipline: "ux-designer",
    },
    {
      title: "A build",
      price: 6000,
      hours: 80,
      impliedHourlyRate: 75,
      outcome: "WON" as const,
      discipline: "frontend-developer",
    },
  ];

  it("tags each past quote with the work it was", () => {
    const prompt = buildGenerateUserPrompt({ ...DRAFT, disciplines: TWO }, history);
    expect(prompt).toContain("[ux-designer]");
    expect(prompt).toContain("[frontend-developer]");
  });

  it("says to anchor hardest on the matching ones", () => {
    const prompt = buildGenerateUserPrompt({ ...DRAFT, disciplines: TWO }, history);
    expect(prompt).toContain("Anchor hardest on the ones matching the discipline you name");
  });

  it("says nothing about tags when no past quote has one", () => {
    const untagged = history.map(({ discipline, ...rest }) => {
      void discipline;
      return rest;
    });
    const prompt = buildGenerateUserPrompt({ ...DRAFT, disciplines: TWO }, untagged);
    expect(prompt).not.toContain("tagged with the kind of work");
  });
});

describe("the wizard offers examples for everything you do", () => {
  it("includes presets from the other disciplines too", () => {
    const one = projectPresetKeys("ux-designer");
    const both = projectPresetKeys("ux-designer", ["frontend-developer"]);
    expect(both.length).toBeGreaterThanOrEqual(one.length);
    expect(new Set(both).size).toBe(both.length);
  });

  it("puts the main one's examples first", () => {
    const both = projectPresetKeys("ux-designer", ["frontend-developer"]);
    const one = projectPresetKeys("ux-designer");
    expect(both[0]).toBe(one[0]);
  });
});

describe("a wrong guess is one press to fix", () => {
  const actions = readFileSync("src/actions/briefs.ts", "utf8");
  const view = readFileSync("src/app/(app)/quote/[briefId]/brief-view.tsx", "utf8");

  it("stores it only when it is one of theirs", () => {
    expect(actions).toContain("disciplines.some((option) => option.key === generated.discipline)");
    expect(actions).toContain("mine.includes(discipline)");
  });

  it("shows it on the quote, with the alternatives", () => {
    expect(view).toContain("t.brief.quotedAs");
    expect(view).toContain("setQuoteDisciplineAction");
  });

  it("says nothing when the account does one kind of work", () => {
    expect(view).toContain("disciplines.length > 1");
  });
});
