import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  PROTECTION_LEVELS,
  discoveryInstruction,
  isProtectionLevel,
  protectionFor,
  protectionInstruction,
} from "@/lib/protection";
import { brokenRules, DEFAULT_RULE_SETTINGS, type CheckableQuote } from "@/lib/ground-rules";
import { planSchema } from "@/lib/quote-plan";

/**
 * One question instead of a list of failures.
 *
 * The rules used to arrive as five panels naming what a finished quote was
 * missing, identically for a client of two years and a stranger. These tests
 * hold the reframing: the level is chosen once, before anything is written, it
 * decides what the quote carries, and the checks afterwards measure the quote
 * against that answer rather than against the maximum.
 */
describe("the three levels", () => {
  it("asks for less from somebody you know than from somebody you do not", () => {
    const known = protectionFor("KNOWN");
    const fresh = protectionFor("NEW");
    const guarded = protectionFor("GUARDED");
    expect(known.rules.length).toBeLessThan(fresh.rules.length);
    expect(fresh.rules.length).toBeLessThan(guarded.rules.length);
  });

  it("leaves a known client's quote free of clauses that read as suspicion", () => {
    const known = protectionFor("KNOWN");
    expect(known.rules).not.toContain("cancellation");
    expect(known.rules).not.toContain("deemedAcceptance");
    expect(known.paidDiscovery).toBe(false);
  });

  it("changes the money at the top level, not only the wording", () => {
    // A cancellation clause records what happens. Milestones are what stop
    // somebody carrying a project they are never paid for.
    expect(protectionFor("GUARDED").paymentPlan).toBe("MILESTONE");
    expect(protectionFor("GUARDED").paidDiscovery).toBe(true);
  });

  it("leaves the freelancer's own payment choice alone below the top level", () => {
    expect(protectionFor("KNOWN").paymentPlan).toBeUndefined();
    expect(protectionFor("NEW").paymentPlan).toBeUndefined();
  });

  it("still asks for the essentials at every level", () => {
    for (const level of PROTECTION_LEVELS) {
      expect(protectionFor(level).rules).toContain("paymentBasis");
      expect(protectionFor(level).sections).toContain("includeSOW");
    }
  });

  it("knows a level from anything else", () => {
    expect(isProtectionLevel("GUARDED")).toBe(true);
    expect(isProtectionLevel("PARANOID")).toBe(false);
    expect(isProtectionLevel(null)).toBe(false);
  });
});

describe("what the model is told", () => {
  it("keeps the guarded tone matter of fact rather than defensive", () => {
    const guarded = protectionInstruction("GUARDED");
    expect(guarded).toContain("never defensive");
    expect(guarded).toContain("not somebody who expects to be cheated");
  });

  it("tells it to stay warm with a client they know", () => {
    expect(protectionInstruction("KNOWN")).toContain("Do not add clauses that read as guarding");
  });

  it("prices discovery as a fraction of the job, and says it comes off the total", () => {
    const out = discoveryInstruction(40, "$", 50);
    // Eight hours of a forty-hour job, capped at four.
    expect(out).toContain("4 hours");
    expect(out).toContain("$200");
    expect(out).toContain("comes off the total");
  });

  it("keeps discovery small on a small job", () => {
    expect(discoveryInstruction(5, "$", 50)).toContain("2 hours");
  });
});

describe("the plan proposes a level", () => {
  it("defaults to a new client when the model says nothing", () => {
    // Most quotes are for somebody new, and assuming familiarity would strip
    // protection from the case that needs it.
    expect(planSchema.parse({}).protection).toBe("NEW");
    expect(planSchema.parse({}).risks).toEqual([]);
  });

  it("refuses a level it does not recognise", () => {
    expect(planSchema.safeParse({ protection: "PARANOID" }).success).toBe(false);
  });

  it("asks for the reasons, in the freelancer's language", () => {
    const source = readFileSync("src/lib/quote-plan.ts", "utf8");
    expect(source).toContain("Risk markers that point to GUARDED");
    expect(source).toContain("Never guess at the client");
  });
});

describe("the flags measure against the answer, not the maximum", () => {
  const bare: CheckableQuote = {
    hours: 8,
    price: 400,
    milestoneCount: 1,
    paymentPlan: "SPLIT",
    extras: { paymentTerms: "50% up front, the rest on delivery.", revisions: "Two rounds." },
  };

  it("does not tell a known client's quote it is missing what it left out on purpose", () => {
    const keys = brokenRules({ ...bare, protection: "KNOWN" }, DEFAULT_RULE_SETTINGS).map(
      (r) => r.key
    );
    expect(keys).toEqual([]);
  });

  it("still raises everything the chosen level asked for", () => {
    const keys = brokenRules({ ...bare, protection: "NEW" }, DEFAULT_RULE_SETTINGS).map(
      (r) => r.key
    );
    expect(keys).toContain("assumptions");
    expect(keys).toContain("cancellation");
  });

  it("checks a quote written before levels existed against everything", () => {
    const keys = brokenRules(bare, DEFAULT_RULE_SETTINGS).map((r) => r.key);
    expect(keys).toContain("assumptions");
  });
});

describe("how the wizard applies it", () => {
  const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");
  const review = readFileSync("src/components/quote/plan-review.tsx", "utf8");

  it("asks the question before anything is written", () => {
    expect(review).toContain("t.quote.protectionTitle");
    expect(review).toContain("chooseProtection");
  });

  it("shows why it proposed what it proposed", () => {
    expect(review).toContain("plan.risks.length > 0");
  });

  it("lets the level set the money", () => {
    expect(wizard).toContain("armour.paymentPlan");
  });

  it("only offers discovery for something nobody has opened", () => {
    expect(wizard).toContain("armour.paidDiscovery && plan.sightUnseen");
  });

  it("remembers the level on the quote", () => {
    const actions = readFileSync("src/actions/briefs.ts", "utf8");
    expect(actions).toContain("isProtectionLevel(draftInput.protection)");
  });
});
