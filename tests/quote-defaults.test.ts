import { describe, it, expect } from "vitest";
import {
  resolveSetup,
  resolveExpertise,
  decidedRows,
  changedRows,
  learn,
  keep,
  describeRow,
  FALLBACK_SECTIONS,
  type AccountDefaults,
  type QuoteSetup,
  type SetupWords,
} from "@/lib/quote-defaults";

const BLANK: AccountDefaults = {};

const SAVED: AccountDefaults = {
  defaultRate: 65,
  defaultRateUnit: "HOUR",
  currency: "GBP",
  defaultPaymentPlan: "SPLIT",
  defaultUpfrontPercent: 40,
  defaultSections: ["includeStrategy", "includeTimeline", "includeSOW", "includeTerms"],
  defaultTermsNote: "Two weeks notice to cancel.",
  defaultFormat: "PDF",
  defaultTemplate: "editorial",
  defaultBranding: "own",
  expertiseLevel: "Expert",
};

describe("resolveExpertise", () => {
  it("prefers what was said over what was guessed", () => {
    // The inference runs off files and past work and will sometimes be wrong.
    // A correction that an inference could overwrite is not a correction.
    expect(resolveExpertise("Mid-level", "Expert")).toBe("Mid-level");
  });

  it("uses the guess when nothing was said", () => {
    expect(resolveExpertise(null, "Junior")).toBe("Junior");
  });

  it("falls back when neither is known", () => {
    expect(resolveExpertise(null, null)).toBe("Senior");
  });

  it("ignores a value that is not a level", () => {
    // The column holds whatever was written to it, including from a version
    // where the set of levels was different.
    expect(resolveExpertise("Principal", null)).toBe("Senior");
  });
});

describe("resolveSetup", () => {
  it("reads a saved account back exactly", () => {
    const setup = resolveSetup(SAVED);
    expect(setup.rate).toBe(65);
    expect(setup.upfrontPercent).toBe(40);
    expect(setup.branding).toBe("own");
    expect(setup.expertise).toBe("Expert");
  });

  it("leaves a blank account with sane values and no nulls", () => {
    const setup = resolveSetup(BLANK);
    expect(setup.rate).toBe(0);
    expect(setup.paymentPlan).toBe("SPLIT");
    expect(setup.sections).toEqual(FALLBACK_SECTIONS);
    expect(setup.termsNote).toBe("");
  });

  it("falls back rather than passing on a template that no longer exists", () => {
    expect(resolveSetup({ defaultTemplate: "brutalist" }).template).toBe("classic");
  });
});

describe("decidedRows", () => {
  it("says nothing has been decided on a new account", () => {
    expect(decidedRows(BLANK)).toEqual([]);
  });

  it("does not count a zero rate as a decision", () => {
    // Otherwise a first quote reads back "£0/hour" as your usual.
    expect(decidedRows({ defaultRate: 0 })).toEqual([]);
  });

  it("counts a saved section set, including a deliberately short one", () => {
    expect(decidedRows({ defaultSections: ["includeSOW"] })).toContain("sections");
  });

  it("does not count a corrupt section set", () => {
    expect(decidedRows({ defaultSections: ["nonsense"] })).toEqual([]);
  });
});

function setupFrom(saved: AccountDefaults, over: Partial<QuoteSetup> = {}): QuoteSetup {
  return { ...resolveSetup(saved), ...over };
}

describe("changedRows", () => {
  it("flags a rate priced differently for this job", () => {
    const setup = setupFrom(SAVED, { rate: 2400, rateUnit: "FIXED" });
    expect(changedRows(setup, SAVED)).toEqual(["rate"]);
  });

  it("flags nothing when the quote matches the usual", () => {
    expect(changedRows(resolveSetup(SAVED), SAVED)).toEqual([]);
  });

  it("flags nothing on a first quote, because there is no usual to differ from", () => {
    const setup = setupFrom(BLANK, { rate: 120, paymentPlan: "UPFRONT" });
    expect(changedRows(setup, BLANK)).toEqual([]);
  });

  it("ignores the upfront percentage when the plan is not a split", () => {
    // The percentage is still in state, and comparing it would flag a change
    // to a number that is not being used.
    const setup = setupFrom(SAVED, { paymentPlan: "UPFRONT", upfrontPercent: 90 });
    expect(changedRows(setup, SAVED)).toEqual(["payment"]);
  });

  it("does not treat a reordered section set as a change", () => {
    const setup = setupFrom(SAVED, {
      sections: ["includeTerms", "includeSOW", "includeTimeline", "includeStrategy"],
    });
    expect(changedRows(setup, SAVED)).toEqual([]);
  });
});

describe("learn", () => {
  it("remembers a first quote's choices", () => {
    const setup = setupFrom(BLANK, {
      rate: 80,
      rateUnit: "DAY",
      paymentPlan: "UPFRONT",
      sections: ["includeSOW"],
    });
    const patch = learn(setup, BLANK);
    expect(patch.defaultRate).toBe(80);
    expect(patch.defaultRateUnit).toBe("DAY");
    expect(patch.defaultPaymentPlan).toBe("UPFRONT");
    expect(patch.defaultSections).toEqual(["includeSOW"]);
  });

  it("leaves a decided row alone, however this quote was priced", () => {
    // The whole point. One fixed-fee job must not make every future quote
    // fixed-fee, and one unusual client must not rewrite the terms.
    const setup = setupFrom(SAVED, {
      rate: 5000,
      rateUnit: "FIXED",
      termsNote: "Unusual: net 60 for this client only.",
    });
    const patch = learn(setup, SAVED);
    expect(patch.defaultRate).toBeUndefined();
    expect(patch.defaultRateUnit).toBeUndefined();
    expect(patch.defaultTermsNote).toBeUndefined();
  });

  it("remembers a note the first time it is typed", () => {
    const setup = setupFrom(BLANK, { revisionsNote: "Two rounds included." });
    expect(learn(setup, BLANK).defaultRevisionsNote).toBe("Two rounds included.");
  });

  it("does not remember whitespace as a note", () => {
    const setup = setupFrom(BLANK, { termsNote: "   " });
    expect(learn(setup, BLANK).defaultTermsNote).toBeUndefined();
  });

  it("does not save a rate nobody gave", () => {
    // Rate is optional: leaving it blank means the price is researched.
    expect(learn(setupFrom(BLANK), BLANK).defaultRate).toBeUndefined();
  });
});

describe("keep", () => {
  it("overwrites the row that was asked about, and only that row", () => {
    const setup = setupFrom(SAVED, { rate: 2400, rateUnit: "FIXED", branding: "mono-dark" });
    const patch = keep("rate", setup);
    expect(patch).toEqual({ defaultRate: 2400, defaultRateUnit: "FIXED" });
  });

  it("keeps a whole presentation choice together", () => {
    const setup = setupFrom(SAVED, { template: "minimal" });
    expect(keep("presentation", setup)).toEqual({
      defaultFormat: "PDF",
      defaultTemplate: "minimal",
      defaultBranding: "own",
    });
  });
});

const WORDS: SetupWords = {
  perHour: "per hour",
  perDay: "per day",
  fixed: "fixed",
  upfrontAll: "All upfront",
  splitTemplate: "{n}% upfront, rest on delivery",
  byMilestone: "By milestone",
  and: "and",
  nothingYet: "Not set",
  sectionNames: {
    includeStrategy: "Strategy",
    includeTimeline: "Timeline",
    includeSOW: "Statement of work",
    includeTerms: "Terms",
    includeRevisions: "Revisions",
    includeAvailability: "Availability",
    includeAI: "AI use",
  },
  formats: { HTML: "Web page", PDF: "PDF", Figma: "Figma" },
  templates: { classic: "Classic", editorial: "Editorial", minimal: "Minimal" },
  brandings: { freely: "Freely look", own: "Your branding", "mono-light": "Mono", "mono-dark": "Mono dark" },
};

describe("describeRow", () => {
  it("states the rate in the currency's own symbol", () => {
    expect(describeRow("rate", resolveSetup(SAVED), WORDS, "£")).toBe("£65 per hour");
  });

  it("says a fixed price is fixed rather than per hour", () => {
    const setup = setupFrom(SAVED, { rate: 2400, rateUnit: "FIXED" });
    expect(describeRow("rate", setup, WORDS, "£")).toBe("£2,400 fixed");
  });

  it("does not describe a rate that was never given", () => {
    expect(describeRow("rate", resolveSetup(BLANK), WORDS, "$")).toBe("Not set");
  });

  it("puts the real percentage in the split", () => {
    expect(describeRow("payment", resolveSetup(SAVED), WORDS, "£")).toBe(
      "40% upfront, rest on delivery"
    );
  });

  it("names every section, joined with a word rather than a comma", () => {
    // This sentence is the whole safety net: it is how you notice that last
    // month's terms are about to go out again.
    expect(describeRow("sections", resolveSetup(SAVED), WORDS, "£")).toBe(
      "Strategy, Timeline, Statement of work and Terms"
    );
  });

  it("reads a single section without a joiner", () => {
    const setup = setupFrom(SAVED, { sections: ["includeSOW"] });
    expect(describeRow("sections", setup, WORDS, "£")).toBe("Statement of work");
  });

  it("describes what the client actually receives", () => {
    expect(describeRow("presentation", resolveSetup(SAVED), WORDS, "£")).toBe(
      "PDF, Editorial and Your branding"
    );
  });
});
