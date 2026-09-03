import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseTimelineStages, timelineSpan, timelineTotal, roadmapTicks } from "@/lib/timeline";
import { paymentClause, revisionsClause, billingFromSettings } from "@/lib/quote-definitions";
import { dict } from "@/lib/i18n";

/**
 * The four questions a real client sent back on a real quote.
 *
 * How long does this run, what is a milestone, is this revision round counted
 * twice, and am I paying the total or the hours. All four were answerable from
 * the quote only by asking, and all four will be asked again on every quote
 * until the template answers them. So they are tests, not an email reply.
 */
const en = dict("en").publicQuote;

describe("how long does the project run", () => {
  const timeline = [
    "Week 1: Discovery - audit the current flow",
    "Week 2: Design - wireframes for the core screens",
    "Week 2: Copy - draft the microcopy alongside the wireframes",
    "Week 3-4: Build support - answer developer questions",
  ].join("\n");

  it("adds the stages up to one number", () => {
    expect(timelineSpan(parseTimelineStages(timeline))).toEqual({ unit: "week", from: 1, to: 4 });
  });

  it("counts concurrent stages once", () => {
    // Two stages inside week 2 is still four weeks of project, and reading it
    // as five is exactly the confusion this fixes.
    expect(timelineTotal(timeline, en)).toContain("4 weeks in total");
  });

  it("says out loud that some stages overlap", () => {
    expect(timelineTotal(timeline, en)).toContain(en.concurrent);
  });

  it("leaves the overlap sentence off when nothing overlaps", () => {
    const clean = "Week 1: One - a\nWeek 2: Two - b";
    expect(timelineTotal(clean, en)).toBe("2 weeks in total.");
  });

  it("draws one dot per distinct period", () => {
    expect(roadmapTicks(parseTimelineStages(timeline))).toEqual(["Week 1", "Week 2", "Week 3-4"]);
  });

  it("says nothing rather than guessing when the units are mixed", () => {
    // A wrong total on a document somebody signs is worse than no total.
    expect(timelineTotal("Week 1: One - a\nDay 4: Two - b", en)).toBe("");
    expect(timelineTotal("Phase one: kickoff\nPhase two: build", en)).toBe("");
    expect(timelineTotal("", en)).toBe("");
  });

  it("handles a single stage", () => {
    expect(timelineTotal("Week 1-2: All of it - everything", en)).toBe("2 weeks in total.");
  });
});

describe("what is a milestone, and what is a round", () => {
  it("defines a milestone wherever the quote is billed in them", () => {
    const out = paymentClause(
      "Each milestone is invoiced on completion.",
      { hasMilestones: true, billing: "FIXED_TOTAL", fixedPrice: false },
      en
    );
    expect(out).toContain(en.milestoneMeans);
  });

  it("leaves the definition off a quote with no milestones", () => {
    const out = paymentClause(
      "50% up front, the rest on delivery.",
      { hasMilestones: false, billing: "FIXED_TOTAL", fixedPrice: false },
      en
    );
    expect(out).not.toContain(en.milestoneMeans);
  });

  it("defines a round of revisions", () => {
    expect(revisionsClause("Two rounds are included.", en)).toContain(en.roundMeans);
  });

  it("adds nothing to a clause that is not there", () => {
    expect(revisionsClause("", en)).toBe("");
    expect(revisionsClause(undefined, en)).toBe("");
  });
});

describe("the price, or an estimate", () => {
  it("says which one, in the payment terms", () => {
    const fixed = paymentClause("Paid on delivery.", { hasMilestones: false, billing: "FIXED_TOTAL", fixedPrice: false }, en);
    expect(fixed).toContain(en.billedFixed);

    const tracked = paymentClause("Paid on delivery.", { hasMilestones: false, billing: "HOURLY_TRACKED", fixedPrice: false }, en);
    expect(tracked).toContain(en.billedTracked);
    expect(tracked).toContain("80%");
  });

  it("stays quiet on a fixed-price quote, which shows no rate to be unsure about", () => {
    const out = paymentClause("Paid on delivery.", { hasMilestones: false, billing: "FIXED_TOTAL", fixedPrice: true }, en);
    expect(out).toBe("Paid on delivery.");
  });

  it("treats an old quote, and anything unrecognised, as a fixed total", () => {
    expect(billingFromSettings(null)).toBe("FIXED_TOTAL");
    expect(billingFromSettings({})).toBe("FIXED_TOTAL");
    expect(billingFromSettings({ billing: "CEILING" })).toBe("FIXED_TOTAL");
    expect(billingFromSettings({ billing: "HOURLY_TRACKED" })).toBe("HOURLY_TRACKED");
  });
});

describe("what the model is told", () => {
  const prompt = readFileSync("src/lib/anthropic.ts", "utf8");

  it("forbids listing a review or a revision round as a deliverable", () => {
    expect(prompt).toContain("Never list a review, a feedback session, a revision round");
  });

  it("forbids an open-ended revisions count", () => {
    expect(prompt).toContain('Never write "within reason"');
  });

  it("forbids reusing a week without saying the work is concurrent", () => {
    expect(prompt).toContain("Two stages may share a range only when the work genuinely happens at the same time");
  });

  it("never offers hourly billing under a ceiling", () => {
    // A cap on hourly billing removes the upside and leaves the overrun with
    // the freelancer, so Freely does not offer it as a choice at all.
    const definitions = readFileSync("src/lib/quote-definitions.ts", "utf8");
    expect(definitions).not.toContain('"CEILING"');
    expect(prompt).toContain("Never call it a fixed price, a capped price or a maximum");
  });
});

describe("the source is evidence, not copy", () => {
  const prompt = readFileSync("src/lib/anthropic.ts", "utf8");

  /**
   * A real quote came back with the freelancer's private email reasoning in
   * its scope, including the line about expecting to run over and absorbing
   * it. That is a negotiating position, published to the client under the
   * freelancer's own name, because the model read a pasted thread as text to
   * summarise rather than as a record to read facts out of.
   */
  it("forbids reusing the source's sentences", () => {
    expect(prompt).toContain("It is NOT copy to reuse");
    expect(prompt).toContain("Never lift sentences, phrases or turns of phrase from the source");
  });

  it("forbids carrying the freelancer's own position into the quote", () => {
    expect(prompt).toContain("what they are willing to absorb");
    expect(prompt).toContain('"In all honesty"');
  });

  it("keeps the freelancer's own tools out of a client's document", () => {
    // A client does not need to know which time tracker runs in the
    // background, and naming one invites an argument about it.
    expect(prompt).toContain("time trackers, invoicing apps or task boards");
  });

  it("takes the structure the source already states", () => {
    expect(prompt).toContain("If the source material already names the milestones");
    expect(prompt).toContain("the later message wins");
  });
});
