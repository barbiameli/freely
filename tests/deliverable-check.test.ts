import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { happenings, isHappening, isPositionLabel, withoutPositionPrefix } from "@/lib/deliverable-check";
import { splitDeliverable } from "@/lib/rich-text";
import { brokenRules, DEFAULT_RULE_SETTINGS } from "@/lib/ground-rules";

/**
 * A deliverable is a thing, not a happening.
 *
 * A real quote listed "Design review session" and "Feedback-incorporated final
 * Figma files" as deliverables seven and nine, and the client wrote back
 * asking whether that was one round of revisions or two. He was right to ask:
 * a round of revisions only exists if he responds, and a quote cannot promise
 * something conditional on the client doing their part as though it were an
 * item being bought.
 */
describe("what is not a deliverable", () => {
  it("catches a revision round however it is worded", () => {
    expect(isHappening("One round of revisions")).toBe(true);
    expect(isHappening("Amends pass")).toBe(true);
    expect(isHappening("Second iteration")).toBe(true);
  });

  it("catches meetings by any of their names", () => {
    expect(isHappening("Design review session")).toBe(true);
    expect(isHappening("Implementation support call")).toBe(true);
    expect(isHappening("Stakeholder workshop")).toBe(true);
    expect(isHappening("Handover")).toBe(true);
  });
});

describe("what is", () => {
  it("leaves real artifacts alone", () => {
    expect(isHappening("Redesigned screens for Flow 1")).toBe(false);
    expect(isHappening("Annotated Figma file")).toBe(false);
    expect(isHappening("Flow review doc")).toBe(false);
  });

  it("keeps the artifact a meeting produces", () => {
    // "Workshop materials" is a thing somebody is handed. Flagging it would
    // make the check cry wolf on half an honest research quote, and a check
    // that cries wolf is one people turn off.
    expect(isHappening("Workshop materials")).toBe(false);
    expect(isHappening("Interview notes")).toBe(false);
    expect(isHappening("Session recording")).toBe(false);
  });

  it("reads only the name, not the description after it", () => {
    // The prompt asks for "Name - what it is", and the description almost
    // always mentions the review that produced the artifact.
    expect(
      isHappening("Redesigned screens - incorporating your feedback from the review call")
    ).toBe(false);
  });

  it("works in Spanish", () => {
    expect(isHappening("Ronda de revisiones")).toBe(true);
    expect(isHappening("Pantallas rediseñadas")).toBe(false);
    expect(isHappening("Notas de la reunión")).toBe(false);
  });

  it("says nothing about an empty list", () => {
    expect(happenings([])).toEqual([]);
    expect(isHappening("")).toBe(false);
  });

  it("names which lines, by position", () => {
    const found = happenings([
      "Flow review doc",
      "Design review session",
      "Redesigned screens",
      "One round of revisions",
    ]);
    expect(found.map((f) => f.index)).toEqual([1, 3]);
  });
});

describe("as a ground rule", () => {
  const quote = {
    hours: 8,
    price: 400,
    milestoneCount: 1,
    protection: "KNOWN" as const,
    paymentPlan: "SPLIT",
    extras: { paymentTerms: "50% up front.", revisions: "Two rounds included." },
  };

  it("fires on a quote that promises a review as an item", () => {
    const keys = brokenRules(
      { ...quote, deliverables: ["Screens", "Design review session"] },
      DEFAULT_RULE_SETTINGS
    ).map((r) => r.key);
    expect(keys).toContain("deliverablesAreThings");
  });

  it("stays quiet on a clean list", () => {
    const keys = brokenRules(
      { ...quote, deliverables: ["Screens", "Annotated Figma file"] },
      DEFAULT_RULE_SETTINGS
    ).map((r) => r.key);
    expect(keys).not.toContain("deliverablesAreThings");
  });

  it("applies at every protection level", () => {
    // A list promising a review session is confusing to somebody who trusts
    // you, not only to somebody who does not.
    const protection = readFileSync("src/lib/protection.ts", "utf8");
    expect(protection.match(/"deliverablesAreThings"/g)?.length).toBe(3);
  });
});

describe("a deliverable is not a position on a calendar", () => {
  // The six lines from a real quote. Three read "Milestone 1" and three read
  // "Milestone 2", because the split promoted the prefix to the heading and
  // demoted the artifact to the grey line under it.
  const real = [
    "Milestone 1: End of Week 1: Flow review doc covering both priority flows, with friction points and drop-off risks identified",
    "Milestone 1: End of Week 1: Stakeholder interview guide, a structured question set built around current behaviour, workarounds, and goals",
    "Milestone 2: End of Week 2: Redesigned Figma screens for Flow 1, covering the updated user journey with interaction states at PoC level",
  ];

  it("strips both prefixes, not just the first", () => {
    expect(withoutPositionPrefix(real[0])).toBe(
      "Flow review doc covering both priority flows, with friction points and drop-off risks identified"
    );
  });

  it("leaves the lines with names of their own", () => {
    const names = real.map((line) => splitDeliverable(withoutPositionPrefix(line)).lead);
    expect(new Set(names).size).toBe(names.length);
    expect(names[0]).toBe("Flow review doc covering both priority flows");
  });

  it("knows a position from a name", () => {
    for (const label of ["Milestone 1", "Phase 2", "Week 1", "End of Week 2", "Hito 1", "Semana 2"]) {
      expect(isPositionLabel(label)).toBe(true);
    }
    for (const name of ["Flow review document", "Annotated Figma screens", "Interview guide"]) {
      expect(isPositionLabel(name)).toBe(false);
    }
  });

  it("refuses to make a heading out of a position", () => {
    // Belt and braces: even unstripped, the splitter must not promote it.
    const split = splitDeliverable("Milestone 1: Flow review doc covering both priority flows");
    expect(split.lead).not.toBe("Milestone 1");
  });

  it("leaves an honest deliverable alone", () => {
    const plain = "Annotated Figma screens for Flow 1, covering the updated journey";
    expect(withoutPositionPrefix(plain)).toBe(plain);
  });
});
