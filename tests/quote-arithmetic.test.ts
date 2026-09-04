import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { impossibleSchedule, reconcilePrice } from "@/lib/quote-arithmetic";

/**
 * The numbers on a quote have to agree with each other.
 *
 * The prompt tells the model the rate is fixed, that its only real decision is
 * the hours, and that price is hours times rate. Then nothing checked, so a
 * quote could go out saying fifty an hour, thirteen hours and nine hundred
 * pounds. The only person who would notice is the client, doing the
 * multiplication a freelancer asked them to trust.
 */
describe("the total", () => {
  it("is corrected when the model's own numbers do not multiply", () => {
    const out = reconcilePrice({ price: 900, hours: 13 }, 50, "HOUR");
    expect(out.price).toBe(650);
    expect(out.saidPrice).toBe(900);
  });

  it("leaves a correct quote alone", () => {
    const out = reconcilePrice({ price: 650, hours: 13 }, 50, "HOUR");
    expect(out).toEqual({ price: 650, hours: 13, saidPrice: null });
  });

  it("forgives a rounding difference", () => {
    // Day rates convert through a working day and land on a tenth of a day, so
    // an exact match is not always available.
    expect(reconcilePrice({ price: 651, hours: 13 }, 50, "HOUR").saidPrice).toBeNull();
  });

  it("prices a day rate in days", () => {
    // Two days at 400 is 800, not 16 hours times 400.
    const out = reconcilePrice({ price: 6400, hours: 16 }, 400, "DAY");
    expect(out.price).toBe(800);
  });

  it("never touches a fixed price", () => {
    // There the total is the agreed thing and the hours are context.
    const out = reconcilePrice({ price: 2400, hours: 30 }, 80, "FIXED");
    expect(out).toEqual({ price: 2400, hours: 30, saidPrice: null });
  });

  it("does nothing without a rate to multiply", () => {
    expect(reconcilePrice({ price: 900, hours: 13 }, null, "HOUR").price).toBe(900);
    expect(reconcilePrice({ price: 900, hours: 13 }, 0, "HOUR").price).toBe(900);
  });

  it("does nothing without hours", () => {
    expect(reconcilePrice({ price: 900, hours: 0 }, 50, "HOUR").price).toBe(900);
  });
});

describe("hours against the timeline", () => {
  it("says nothing about an ordinary shape", () => {
    // A fortnight can hold six hours of work or sixty, and only the freelancer
    // knows whether this one is part time.
    expect(impossibleSchedule(40, 4, "HOUR")).toBeNull();
  });

  it("catches more work than the weeks can hold", () => {
    expect(impossibleSchedule(200, 2, "HOUR")).toBe("tooMuch");
  });

  it("catches a timeline describing waiting rather than working", () => {
    // It will read to a client as the job taking that long.
    expect(impossibleSchedule(6, 8, "HOUR")).toBe("tooLittle");
  });

  it("says nothing when either number is missing", () => {
    expect(impossibleSchedule(0, 4, "HOUR")).toBeNull();
    expect(impossibleSchedule(40, 0, "HOUR")).toBeNull();
  });
});

describe("where it runs", () => {
  const actions = readFileSync("src/actions/briefs.ts", "utf8");

  it("checks a newly generated quote", () => {
    expect(actions).toContain("reconcilePrice(\n    { price: generated.price");
  });

  it("checks a refined one too, and keeps the result", () => {
    /**
     * Price and hours used to be dropped on refine: everything else came back
     * and these two were discarded, so "make it three thousand" appeared to do
     * nothing. Worse, the milestones were rebalanced against the new price
     * while the quote kept the old one, so the stages summed to a total the
     * document did not show.
     */
    expect(actions).toContain("reconcilePrice(\n    { price: updated.price");
    expect(actions).toContain("price: updated.price,\n      hours: updated.hours,");
  });

  it("says so in the log rather than silently", () => {
    expect(actions).toContain("the model's total did not match its own hours");
  });
});
