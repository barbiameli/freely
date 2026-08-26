import { describe, it, expect } from "vitest";
import { applyHiddenSections, HIDEABLE_SECTIONS, isHideable } from "../src/lib/hidden-sections";

const BRIEF = {
  title: "A quote",
  strategy: { goal: "g", findings: [], aiWill: [], aiWillNot: [], openQuestions: [] },
  timeline: "Week 1: start",
  extras: {
    paymentTerms: "50% up front",
    revisions: "Two rounds",
    availability: "From May",
    terms: { cancellation: "c", ownership: "o", confidentiality: "f" },
    aiUsage: { will: ["a"], willNot: ["b"] },
  },
};

describe("applyHiddenSections", () => {
  it("hands the quote back untouched when nothing was removed", () => {
    expect(applyHiddenSections(BRIEF, [])).toBe(BRIEF);
  });

  it("takes out only what was named", () => {
    const out = applyHiddenSections(BRIEF, ["strategy", "revisions"]);
    expect(out.strategy).toBeNull();
    expect(out.extras?.revisions).toBeUndefined();
    expect(out.extras?.paymentTerms).toBe("50% up front");
    expect(out.timeline).toBe("Week 1: start");
  });

  it("empties the timeline rather than leaving a heading with nothing under it", () => {
    expect(applyHiddenSections(BRIEF, ["timeline"]).timeline).toBe("");
  });

  it("never writes back to the quote it was given", () => {
    applyHiddenSections(BRIEF, HIDEABLE_SECTIONS);
    expect(BRIEF.strategy).not.toBeNull();
    expect(BRIEF.extras.terms.ownership).toBe("o");
  });

  it("ignores a key from some other version of the app", () => {
    const out = applyHiddenSections(BRIEF, ["price"]);
    expect(out.strategy).not.toBeNull();
    expect(isHideable("price")).toBe(false);
  });

  it("leaves the core sections out of the removable set", () => {
    for (const core of ["scope", "deliverables", "price"]) {
      expect(isHideable(core)).toBe(false);
    }
  });
});
