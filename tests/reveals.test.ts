import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { allDisciplines, disciplineLabels, disciplineLine } from "@/lib/industries";

/**
 * A panel that opened because of a choice should look like one.
 *
 * These were styled as more form: same background, same labels, a top border,
 * sitting under the control that opened them. Pressing "not sure what to
 * charge" produced four new fields indistinguishable from the four already
 * there, and the only sign anything had happened was the page getting longer.
 */
const reveal = readFileSync("src/components/ui/reveal.tsx", "utf8");
const rows = readFileSync("src/components/quote/setup-rows.tsx", "utf8");

describe("the revealed panel", () => {
  it("uses a tint the surrounding form does not", () => {
    expect(reveal).toContain("bg-violet-tint");
    expect(reveal).toContain("border-l-[3px]");
  });

  it("always has something to say about itself", () => {
    // An unlabelled panel that appears under a control is a surprise.
    expect(reveal).toContain("title");
    expect(reveal).toContain("hint");
  });

  it("is not a Card, so it cannot compete with the thing that opened it", () => {
    expect(reveal).not.toContain('from "@/components/ui/card"');
  });
});

describe("every branch that opens one uses it", () => {
  for (const [what, marker] of [
    ["the rate helper", "t.quote.rateHelpTitle"],
    ["the questions a chosen section asks", "t.quote.sectionQuestionsTitle"],
    ["availability", "t.quote.availabilityPrompt"],
    ["the deposit split", "t.quote.paymentHowMuchUpfront"],
    ["the milestone questions", "t.quote.milestonesSection"],
  ] as const) {
    it(`wraps ${what}`, () => {
      const index = rows.indexOf(marker);
      expect(index, marker).toBeGreaterThan(-1);
      // The marker is a Reveal prop rather than a SubLabel child.
      expect(rows.slice(index - 120, index)).toContain("<Reveal");
    });
  }

  it("puts white fields inside the tint rather than paper on paper", () => {
    expect(rows).not.toMatch(/Reveal[\s\S]{0,900}bg-paper border border-line rounded-lg/);
  });
});

/**
 * One label never covered everybody. Plenty of freelancers are a designer who
 * also builds, and making them pick one made the answer a lie.
 */
describe("more than one kind of work", () => {
  it("puts the main one first and drops the empties", () => {
    expect(allDisciplines("ux-designer", ["frontend-developer", ""])).toEqual([
      "ux-designer",
      "frontend-developer",
    ]);
  });

  it("never lists the main one twice", () => {
    expect(allDisciplines("ux-designer", ["ux-designer", "content-creator"])).toEqual([
      "ux-designer",
      "content-creator",
    ]);
  });

  it("survives an account that has neither", () => {
    expect(allDisciplines(null, null)).toEqual([]);
    expect(disciplineLine(null, null)).toBe("");
  });

  it("says one thing for one discipline", () => {
    const line = disciplineLine("ux-designer", []);
    expect(line).toContain("works as a UX designer");
    expect(line).not.toContain("also does");
  });

  it("tells the model to quote a mixed job as one job", () => {
    const line = disciplineLine("ux-designer", ["frontend-developer"]);
    expect(line).toContain("mainly as a UX designer");
    expect(line).toContain("as one person doing all of it");
  });

  it("reads back as labels a person would recognise", () => {
    expect(disciplineLabels("ux-designer", ["content-creator"])).toEqual([
      "UX designer",
      "Content creator / writer",
    ]);
  });
});

describe("what the price is keyed on", () => {
  const actions = readFileSync("src/actions/rate.ts", "utf8");
  const memory = readFileSync("src/actions/memory.ts", "utf8");

  /**
   * The main discipline stays single. It is the key the market rate cache is
   * shared on, and an average across "a bit of everything" is not a rate
   * anybody could defend to a client.
   */
  it("researches the rate against the main discipline only", () => {
    expect(actions).toContain("industry: user.industry");
    expect(actions).not.toContain("otherIndustries");
  });

  it("refuses an unknown discipline rather than storing it", () => {
    expect(memory).toContain("INDUSTRY_OPTIONS.some");
    expect(memory).toContain("key !== patch.industry");
  });
});
