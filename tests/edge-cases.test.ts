import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { answersForPrompt, milestonesForPrompt, planSchema } from "@/lib/quote-plan";

/**
 * What a model does when it does not do what it was asked.
 *
 * Every one of these was found by running it rather than by reading, and every
 * one of them turned a good reading into "couldn't make sense of that brief",
 * or into a quote quietly built on the wrong answer.
 */
describe("one bad line does not lose the reading", () => {
  it("keeps the plan when a money ask is nonsense", () => {
    const parsed = planSchema.parse({
      reading: "Two flows, one internal tool.",
      moneyAsks: [{ topic: "budget", value: "5000" }],
    });
    expect(parsed.reading).toBe("Two flows, one internal tool.");
    expect(parsed.moneyAsks).toEqual([]);
  });

  it("keeps the plan when the protection level is invented", () => {
    expect(planSchema.parse({ reading: "x", protection: "TERRIFIED" }).protection).toBe("NEW");
  });

  it("still keeps the good asks alongside the bad", () => {
    const parsed = planSchema.parse({
      moneyAsks: [
        { topic: "nonsense", value: "1" },
        { topic: "deposit", value: "30", quote: "30% up front" },
        { topic: "alsoNonsense", value: "2" },
      ],
    });
    expect(parsed.moneyAsks).toHaveLength(1);
    expect(parsed.moneyAsks[0].value).toBe("30");
  });
});

describe("a model that repeats itself", () => {
  it("does not apply one answer to two identical questions", () => {
    /**
     * Both questions read the same, so keying answers on their text gave the
     * first one's answer to both and silently dropped the second assumption.
     */
    const plan = planSchema.parse({
      questions: [
        { ask: "How many screens?", assume: "12 screens" },
        { ask: "How many screens?", assume: "2 flows" },
      ],
    });
    const out = answersForPrompt(plan, [
      { index: 0, ask: "How many screens?", answer: "Nine." },
    ]);
    expect(out).toContain("How many screens? Nine.");
    expect(out).toContain("Not answered, so assume: 2 flows");
  });

  it("does not keep or drop two identically named stages together", () => {
    const plan = planSchema.parse({
      milestones: [
        { name: "Design", gate: "", delivers: ["Wireframes"] },
        { name: "Design", gate: "", delivers: ["Visuals"] },
      ],
    });
    const out = milestonesForPrompt(plan, [1]);
    expect(out).toContain("Visuals");
    expect(out).not.toContain("Wireframes");
  });
});

describe("the promises the app makes on your behalf", () => {
  const actions = readFileSync("src/actions/briefs.ts", "utf8");

  it("will not take down a quote a client was sent a link to", () => {
    // The acceptance email says the link will always show what was signed.
    // Unpublishing turned that into a dead page with no way to tell them.
    expect(actions).toContain("Taking it down would break the copy they were sent");
  });

  it("numbers follow-on quotes rather than calling them all the second", () => {
    expect(actions).toContain("${followOnCount + 2}");
  });
});

describe("hours claimed from a calendar", () => {
  const actions = readFileSync("src/actions/time.ts", "utf8");

  it("will not match a client name inside a longer word", () => {
    // "Ergonomics workshop" was being claimed for a client called Ergo. An
    // hour wrongly billed is worse than an hour nobody imported.
    expect(actions).toContain("new RegExp(");
    expect(actions).toContain("escapeRegex(needle)");
  });

  it("ignores the stand-in name a brief with no client produces", () => {
    expect(actions).toContain("GENERIC_CLIENTS");
  });

  it("ignores a name too short to be a word", () => {
    expect(actions).toContain("needle.length >= 4");
  });
});

describe("paid discovery is priced from the job", () => {
  it("does not derive hours from the rate", () => {
    /**
     * It was passing the rate times eight as if it were hours, so a fifty an
     * hour rate claimed a four hundred hour project. It only produced a sane
     * fee because the length is capped at four hours, which is the kind of
     * accident that stops being one when the cap changes.
     */
    const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");
    expect(wizard).not.toContain("draft.hourlyRate * 8");
    expect(wizard).toContain("plan.milestones.length * 8 || 20");
  });
});
