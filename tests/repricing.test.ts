import { describe, it, expect } from "vitest";
import { repriceForHours, effectiveRate } from "@/lib/repricing";

describe("effectiveRate", () => {
  it("uses the rate the quote was built with", () => {
    expect(effectiveRate(4000, 40, 65)).toBe(65);
  });

  it("falls back to the rate the numbers imply, for quotes with no stored rate", () => {
    expect(effectiveRate(4000, 40, null)).toBe(100);
  });

  it("gives zero when there is nothing to work from", () => {
    expect(effectiveRate(0, 0, null)).toBe(0);
  });
});

describe("repriceForHours", () => {
  it("moves the price when the hours change", () => {
    // The bug: editing 40 hours to 60 left the total at the old number.
    const result = repriceForHours(60, 1600, 40, 40);
    expect(result?.price).toBe(2400);
    expect(result?.hours).toBe(60);
  });

  it("works from the implied rate when none was stored", () => {
    expect(repriceForHours(50, 4000, 40, null)?.price).toBe(5000);
  });

  it("does nothing when the hours did not actually change", () => {
    expect(repriceForHours(40, 1600, 40, 40)).toBeNull();
  });

  it("leaves the price alone when there is no rate to work from", () => {
    expect(repriceForHours(60, 0, 0, null)).toBeNull();
  });

  it("rejects nonsense hours rather than zeroing the total", () => {
    expect(repriceForHours(Number.NaN, 1600, 40, 40)).toBeNull();
    expect(repriceForHours(-5, 1600, 40, 40)).toBeNull();
  });

  it("rounds to a whole amount", () => {
    expect(repriceForHours(12.5, 1600, 40, 65)?.price).toBe(813);
  });
});
