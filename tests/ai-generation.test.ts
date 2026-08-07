import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  buildGenerateUserPrompt,
  buildRefineUserPrompt,
  parseBriefResponse,
  briefSchema,
  type QuoteDraftInput,
  type GeneratedBrief,
  type PricingHistoryEntry,
} from "@/lib/anthropic";

const draft: QuoteDraftInput = {
  sourceText: "Client wants a rebrand of their marketing site.",
  instructions: "Focus on discovery phase.",
  memoryProjectTitles: ["Acme Rebrand"],
  detailLevel: "Detailed",
  format: "HTML",
  includeSOW: true,
  includeAI: true,
  includeStrategy: false,
  includeTimeline: true,
  hourlyRate: 65,
  expertiseLevel: "Senior",
};

describe("buildSystemPrompt", () => {
  it("injects the user's memory instructions into the system prompt", () => {
    const prompt = buildSystemPrompt("Write in a warm, direct voice.");
    expect(prompt).toContain("Write in a warm, direct voice.");
    expect(prompt).toContain("Freely");
    expect(prompt).toContain("ONLY valid JSON");
  });

  it("omits stray whitespace when memory instructions are empty", () => {
    const prompt = buildSystemPrompt("   ");
    expect(prompt).not.toMatch(/\s{2,}/);
  });

  it("includes tone, story, context, and file excerpts when provided", () => {
    const prompt = buildSystemPrompt({
      instructions: "Core instructions.",
      toneNotes: "Warm but efficient.",
      storyNotes: "Started in 2019.",
      contextNotes: "We specialize in fintech.",
      fileExcerpts: [{ name: "brand.md", text: "Use coral for headlines." }],
    });
    expect(prompt).toContain("Warm but efficient.");
    expect(prompt).toContain("Started in 2019.");
    expect(prompt).toContain("We specialize in fintech.");
    expect(prompt).toContain("brand.md");
    expect(prompt).toContain("Use coral for headlines.");
  });

  it("skips empty memory sections instead of injecting blank labels", () => {
    const prompt = buildSystemPrompt({ instructions: "Core instructions." });
    expect(prompt).not.toContain("Tone notes:");
    expect(prompt).not.toContain("Studio story");
    expect(prompt).not.toContain("Additional context:");
  });

  it("asks for specific, non-generic quotes with defensible numbers", () => {
    const prompt = buildSystemPrompt("Core instructions.");
    expect(prompt).toMatch(/specificity|defensible/i);
  });
});

describe("buildGenerateUserPrompt", () => {
  it("includes source text, instructions, and settings", () => {
    const prompt = buildGenerateUserPrompt(draft);
    expect(prompt).toContain(draft.sourceText);
    expect(prompt).toContain(draft.instructions);
    expect(prompt).toContain("Detailed");
    expect(prompt).toContain("Acme Rebrand");
    expect(prompt).toContain("Include Statement of Work: true");
  });

  it("falls back to a placeholder when source text is missing", () => {
    const prompt = buildGenerateUserPrompt({ ...draft, sourceText: "" });
    expect(prompt).toContain("no source text provided");
  });

  it("always includes the freelancer's hourly rate", () => {
    const prompt = buildGenerateUserPrompt(draft);
    expect(prompt).toContain("$65/hr");
  });

  it("anchors pricing on past project history when it's available", () => {
    const history: PricingHistoryEntry[] = [
      { title: "Nordic App", price: 6000, hours: 100, impliedHourlyRate: 60 },
    ];
    const prompt = buildGenerateUserPrompt(draft, history);
    expect(prompt).toContain("Pricing history");
    expect(prompt).toContain("Nordic App");
    expect(prompt).toContain("$6,000");
    expect(prompt).not.toContain("Use web search");
  });

  it("asks Claude to research market rates when there's no pricing history", () => {
    const prompt = buildGenerateUserPrompt(draft, []);
    expect(prompt).toContain("web search");
    expect(prompt).toContain("Senior");
    expect(prompt).not.toContain("Pricing history");
  });

  it("asks for a Strategy section only when includeStrategy is set, without any AI-usage split", () => {
    const withStrategy = buildGenerateUserPrompt({ ...draft, includeStrategy: true });
    expect(withStrategy).toContain('"strategy"');
    expect(withStrategy).not.toContain('"aiWill"');
    expect(withStrategy).not.toContain('"aiWillNot"');

    const withoutStrategy = buildGenerateUserPrompt({ ...draft, includeStrategy: false });
    expect(withoutStrategy).not.toContain('strategy" object');
  });

  it("asks for a concrete staged timeline when includeTimeline is set", () => {
    const prompt = buildGenerateUserPrompt({ ...draft, includeTimeline: true });
    expect(prompt).toContain("EACH ON ITS OWN LINE");
    expect(prompt).toContain("Week 1-2: Label - what actually happens");
    expect(prompt).toContain("4-6 stages");
  });

  it("asks for a one-line summary timeline when includeTimeline is not set", () => {
    // The Timeline toggle is the user's call on how much schedule detail the
    // client sees, so leaving it off must not smuggle a full staged
    // breakdown back in through the same field.
    const prompt = buildGenerateUserPrompt({ ...draft, includeTimeline: false });
    expect(prompt).toContain("single short sentence");
    expect(prompt).not.toContain("EACH ON ITS OWN LINE");
    expect(prompt).not.toContain("4-6 stages");
  });

  it("passes a per-quote output note through, and omits the section when blank", () => {
    const withNote = buildGenerateUserPrompt({ ...draft, outputNotes: "keep it to one page" });
    expect(withNote).toContain("keep it to one page");
    expect(withNote).toContain("takes precedence");

    expect(buildGenerateUserPrompt({ ...draft, outputNotes: "   " })).not.toContain(
      "takes precedence"
    );
    expect(buildGenerateUserPrompt(draft)).not.toContain("takes precedence");
  });
});

describe("buildRefineUserPrompt", () => {
  const current: GeneratedBrief = {
    title: "Marketing site rebrand",
    client: "Acme Co",
    scope: "Redesign the marketing site.",
    deliverables: ["Discovery", "Design", "Build"],
    timeline: "4 weeks",
    price: 8000,
    hours: 80,
  };

  it("embeds the current brief and the refinement instruction", () => {
    const prompt = buildRefineUserPrompt(current, "Trim the timeline to 2 weeks.");
    expect(prompt).toContain(JSON.stringify(current));
    expect(prompt).toContain("Trim the timeline to 2 weeks.");
  });
});

describe("parseBriefResponse", () => {
  const valid: GeneratedBrief = {
    title: "Marketing site rebrand",
    client: "Acme Co",
    scope: "Redesign the marketing site.",
    deliverables: ["Discovery", "Design", "Build"],
    timeline: "4 weeks",
    price: 8000,
    hours: 80,
  };

  it("parses a clean JSON response", () => {
    const result = parseBriefResponse(JSON.stringify(valid));
    expect(result).toEqual(valid);
  });

  it("strips markdown fences before parsing", () => {
    const fenced = "```json\n" + JSON.stringify(valid) + "\n```";
    const result = parseBriefResponse(fenced);
    expect(result).toEqual(valid);
  });

  it("parses a response with an optional structured strategy field", () => {
    const strategy = {
      goal: "Ship a clean rebrand.",
      findings: ["Current site lacks a consistent visual language."],
      aiWill: ["Generate responsive variants from one high-fidelity design."],
      aiWillNot: ["Make the final visual-direction call."],
      openQuestions: [],
    };
    const withStrategy = { ...valid, strategy };
    const result = parseBriefResponse(JSON.stringify(withStrategy));
    expect(result.strategy).toEqual(strategy);
  });

  it("pulls the JSON object out of surrounding commentary (e.g. from web search)", () => {
    const wrapped = `Based on my research, here's the quote:\n${JSON.stringify(valid)}\nHope that helps!`;
    const result = parseBriefResponse(wrapped);
    expect(result).toEqual(valid);
  });

  it("throws a clear error on invalid JSON", () => {
    expect(() => parseBriefResponse("not json")).toThrow(/valid JSON/);
  });

  it("throws when the JSON doesn't match the brief schema", () => {
    const bad = JSON.stringify({ title: "Missing fields" });
    expect(() => parseBriefResponse(bad)).toThrow(/validation/);
  });

  it("rejects negative price or hours", () => {
    const bad = JSON.stringify({ ...valid, price: -100 });
    const result = briefSchema.safeParse(JSON.parse(bad));
    expect(result.success).toBe(false);
  });
});
