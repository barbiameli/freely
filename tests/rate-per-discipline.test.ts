import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseRates, rateFor, withRate, disciplinesWithoutRate } from "@/lib/discipline-rates";

/**
 * Every kind of work you do has its own rate.
 *
 * The rule that replaced "one rate, with exceptions". These tests are mostly
 * about the exceptions being gone: an account from before this existed keeps
 * the rate it had, a discipline nobody has priced returns nothing rather than
 * borrowing somebody else's number, and a Json column full of whatever gets
 * read defensively.
 */
describe("a rate per kind of work", () => {
  const account = {
    industry: "designer",
    defaultRate: 80,
    defaultRateUnit: "HOUR",
    ratesByDiscipline: { "marketing-consultant": { rate: 55, unit: "DAY" } },
  };

  it("reads the main discipline off the columns that already existed", () => {
    // No migration wrote anything. Accounts that predate the map still work.
    expect(rateFor("designer", account)).toEqual({ rate: 80, unit: "HOUR" });
  });

  it("reads the others off the map", () => {
    expect(rateFor("marketing-consultant", account)).toEqual({ rate: 55, unit: "DAY" });
  });

  it("returns nothing for work that has never been priced", () => {
    // The important one. Falling back to another discipline's rate would quote
    // a writing job at a design rate and say nothing about it.
    expect(rateFor("copywriter", account)).toBeNull();
    expect(rateFor(null, account)).toBeNull();
  });

  it("does not treat the main columns as an answer for other disciplines", () => {
    expect(rateFor("copywriter", { industry: "designer", defaultRate: 80 })).toBeNull();
  });

  it("names which work still has no rate", () => {
    expect(
      disciplinesWithoutRate(["designer", "marketing-consultant", "copywriter"], account)
    ).toEqual(["copywriter"]);
  });

  it("drops anything malformed rather than pricing work with it", () => {
    expect(
      parseRates({
        good: { rate: 70, unit: "HOUR" },
        zero: { rate: 0, unit: "HOUR" },
        negative: { rate: -5, unit: "HOUR" },
        text: { rate: "70", unit: "HOUR" },
        empty: null,
      })
    ).toEqual({ good: { rate: 70, unit: "HOUR" } });
    expect(parseRates(null)).toEqual({});
    expect(parseRates([1, 2])).toEqual({});
  });

  it("keeps an unknown unit usable by falling back to hourly", () => {
    expect(parseRates({ a: { rate: 40, unit: "WEEK" } })).toEqual({ a: { rate: 40, unit: "HOUR" } });
  });

  it("adds one without disturbing the rest", () => {
    expect(withRate(account.ratesByDiscipline, "copywriter", { rate: 45, unit: "HOUR" })).toEqual({
      "marketing-consultant": { rate: 55, unit: "DAY" },
      copywriter: { rate: 45, unit: "HOUR" },
    });
  });
});

describe("the same question everywhere", () => {
  const setupRows = readFileSync("src/components/quote/setup-rows.tsx", "utf8");

  it("chooses the work before the rate rather than inside the rate helper", () => {
    // It used to live inside "not sure what to charge", which meant the
    // question only got asked by people who did not know their rate.
    const chooser = setupRows.indexOf("t.quote.rateForWhich");
    const helper = setupRows.indexOf("t.quote.rateHelpTitle");
    expect(chooser).toBeGreaterThan(-1);
    expect(chooser).toBeLessThan(helper);
  });

  it("swaps the rate when the work changes", () => {
    expect(setupRows).toContain("function chooseDiscipline");
    expect(setupRows).toMatch(/hourlyRate: saved \? saved\.rate : 0/);
  });

  it("says so when the chosen work has no rate yet", () => {
    expect(setupRows).toContain("rateNoneForWork");
  });

  it("no longer claims the rate is only researched for the main discipline", () => {
    for (const file of ["src/lib/i18n/en.ts", "src/lib/i18n/es.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("researched for the main one");
      expect(source).not.toContain("se investiga para la principal");
    }
  });
});
