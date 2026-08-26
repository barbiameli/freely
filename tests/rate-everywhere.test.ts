import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The rate is asked for in three places, and it is one control.
 *
 * Onboarding, Memory and the quote wizard each ask what somebody charges.
 * Memory and the wizard rendered the same component; onboarding had its own
 * copy, which asked for a level and a country and then did nothing with them.
 * Somebody who said they did not know what to charge answered two questions
 * and left with no rate, while the identical-looking control two screens away
 * would have researched one for them.
 *
 * That is what a second copy always costs. So the test is not about behaviour,
 * it is about there being one implementation: each of the three imports
 * RateBody, and nothing outside it builds the same control by hand.
 */
const SURFACES = {
  onboarding: "src/app/(onboarding)/onboarding/onboarding-form.tsx",
  memory: "src/components/memory/quote-setup-card.tsx",
  wizard: "src/components/quote/setup-rows.tsx",
};

describe("one rate control, three places", () => {
  for (const [name, path] of Object.entries(SURFACES)) {
    it(`${name} uses RateBody`, () => {
      const source = readFileSync(path, "utf8");
      // The wizard's file is where RateBody lives, so it declares rather than
      // imports it. Either counts as using the one implementation.
      const uses = /RateBody/.test(source);
      expect(uses, path).toBe(true);
    });
  }

  // The tell that a copy has appeared: the expertise chips are the distinctive
  // part of the "not sure what to charge" branch, and there should be exactly
  // one place in the app that renders them.
  it("only one file renders the expertise chips", () => {
    const renderers = Object.values(SURFACES).filter((path) =>
      /\["Junior", "Mid-level", "Senior", "Expert"\]/.test(readFileSync(path, "utf8"))
    );
    expect(renderers).toEqual(["src/components/quote/setup-rows.tsx"]);
  });

  // Same for the country picker. Onboarding had its own, which is how the two
  // got out of step in the first place.
  it("only one file renders the country picker inside the rate control", () => {
    const renderers = Object.values(SURFACES).filter((path) =>
      /COUNTRIES\.map/.test(readFileSync(path, "utf8"))
    );
    expect(renderers).toEqual(["src/components/quote/setup-rows.tsx"]);
  });

  it("the one implementation can actually research a rate", () => {
    const source = readFileSync(SURFACES.wizard, "utf8");
    expect(source).toMatch(/researchRateAction/);
    expect(source).toMatch(/findMyRate/);
  });
});
