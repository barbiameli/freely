import { describe, it, expect } from "vitest";
import { extractJsonObject, parseBriefResponse } from "@/lib/anthropic";
import { availabilityFacts } from "@/lib/quote-prompts";

const valid = JSON.stringify({
  title: "Design system rebuild",
  client: "Acme",
  scope: "Rebuild the system",
  deliverables: ["Foundations", "Components"],
  timeline: "Week 1-2: Discovery - interviews",
  price: 4000,
  hours: 40,
});

describe("extractJsonObject", () => {
  it("finds the object when prose surrounds it", () => {
    expect(extractJsonObject(`Here is the quote:\n${valid}\nHope that helps.`)).toBe(valid);
  });

  it("ignores braces in the research narration before the JSON", () => {
    // The bug: a greedy match started at the brace in the prose and swallowed
    // everything, so nothing parsed.
    const narrated = `Rates in that market land around {40-60}/hr per my search.\n${valid}`;
    expect(extractJsonObject(narrated)).toBe(valid);
  });

  it("ignores braces inside strings", () => {
    const withBrace = JSON.stringify({
      title: "A { weird } title",
      client: "Acme",
      scope: "s",
      deliverables: ["d"],
      timeline: "t",
      price: 1,
      hours: 1,
    });
    expect(extractJsonObject(`Preamble.\n${withBrace}`)).toBe(withBrace);
  });

  it("takes the last complete object when there are several", () => {
    const first = '{"draft": true}';
    expect(extractJsonObject(`${first}\nActually:\n${valid}`)).toBe(valid);
  });

  it("returns null when nothing is closed", () => {
    expect(extractJsonObject('{"title": "cut off half way')).toBeNull();
  });
});

describe("parseBriefResponse", () => {
  it("parses a reply wrapped in fences and prose", () => {
    const brief = parseBriefResponse("Sure:\n```json\n" + valid + "\n```\nDone.");
    expect(brief.title).toBe("Design system rebuild");
  });

  it("says a cut-off reply was cut off, not that it was invalid", () => {
    expect(() => parseBriefResponse('{"title": "Design system reb')).toThrow(/cut off/);
  });
});

describe("availability", () => {
  it("passes on what was actually written", () => {
    expect(availabilityFacts("  Could start in September  ")).toEqual([
      "Could start in September",
    ]);
  });

  it("gives nothing back when nothing was said, so the section is skipped", () => {
    expect(availabilityFacts("   ")).toEqual([]);
    expect(availabilityFacts()).toEqual([]);
  });
});
