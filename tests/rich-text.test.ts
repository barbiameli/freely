import { describe, it, expect } from "vitest";
import { splitDeliverable, paragraphs } from "@/lib/rich-text";

describe("splitDeliverable", () => {
  it("separates the name from what it covers", () => {
    const { lead, detail } = splitDeliverable(
      "Token foundations, colour, spacing, radius, shadow, and motion values set up as Variables in Figma"
    );
    expect(lead).toBe("Token foundations");
    expect(detail).toContain("colour, spacing");
  });

  it("splits on a colon too", () => {
    const { lead, detail } = splitDeliverable(
      "Developer handoff: a finalised Figma file with a named handoff page and a token export"
    );
    expect(lead).toBe("Developer handoff");
    expect(detail).toContain("finalised Figma file");
  });

  it("leaves a short name whole", () => {
    expect(splitDeliverable("Wireframes").detail).toBe("");
  });

  it("leaves it whole when the lead is itself a sentence", () => {
    const text = "We will audit the current system. Then rebuild the pieces that are worth keeping.";
    expect(splitDeliverable(text).detail).toBe("");
  });

  it("leaves it whole when the lead is too long to be a name", () => {
    const text =
      "A very long opening clause that runs on well past the point of being any kind of name at all, then some detail";
    expect(splitDeliverable(text).detail).toBe("");
  });

  it("leaves it whole when what follows is too short to be worth splitting", () => {
    expect(splitDeliverable("Component library, phase 2").detail).toBe("");
  });
});

describe("paragraphs", () => {
  it("respects line breaks the model wrote", () => {
    expect(paragraphs("First part.\n\nSecond part.")).toEqual(["First part.", "Second part."]);
  });

  it("breaks a long run of prose into groups of sentences", () => {
    const long =
      "The current design system is fragmented across three files. " +
      "Components have drifted from what is in production. " +
      "The team rebuilds buttons from scratch on every sprint. " +
      "This project consolidates them into one source of truth. " +
      "Everything is named to match the React codebase so nothing needs translating. " +
      "The result is one library the whole team works from rather than three that disagree.";
    const out = paragraphs(long);
    expect(out.length).toBeGreaterThan(1);
    expect(out.join(" ")).toBe(long.trim());
  });

  it("leaves short text as one paragraph", () => {
    expect(paragraphs("A short scope.")).toEqual(["A short scope."]);
  });

  it("does not break on decimals or abbreviations", () => {
    const text = "Rates sit around 3.5x the baseline, e.g. the usual agency markup, which matters.";
    expect(paragraphs(text, 10)).toEqual([text]);
  });

  it("never returns nothing", () => {
    expect(paragraphs("   ")).toEqual([""]);
  });
});
