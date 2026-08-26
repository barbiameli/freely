import { describe, it, expect } from "vitest";
import { windowFor, retryAfterFor } from "@/lib/rate-limit";

/**
 * The arithmetic behind the limiter, without a database.
 *
 * This is the whole design: the window is folded into the row key, which is
 * what turns the check into one atomic upsert with no read-modify-write race.
 * It was only ever exercised through Postgres, so the one property that
 * matters most, where a boundary falls, was tested by making two quick calls
 * and hoping the clock cooperated. It did not, roughly one run in ten.
 *
 * Pure functions with the time passed in. No sleeping, no luck.
 */
const MINUTE = 60_000;

describe("windowFor", () => {
  it("puts a whole window in one bucket", () => {
    const start = 5 * MINUTE;
    expect(windowFor(start, MINUTE)).toBe(5);
    expect(windowFor(start + 1, MINUTE)).toBe(5);
    expect(windowFor(start + MINUTE - 1, MINUTE)).toBe(5);
  });

  it("moves to the next bucket exactly on the boundary", () => {
    expect(windowFor(6 * MINUTE - 1, MINUTE)).toBe(5);
    expect(windowFor(6 * MINUTE, MINUTE)).toBe(6);
  });

  // The cost of a fixed window, and the reason the flaky test was flaky: two
  // calls a millisecond apart are in different buckets if a boundary is
  // between them.
  it("can separate two moments one millisecond apart", () => {
    const boundary = 900 * MINUTE;
    expect(windowFor(boundary - 1, MINUTE)).not.toBe(windowFor(boundary, MINUTE));
  });

  it("counts from the epoch, so two servers agree without talking", () => {
    expect(windowFor(0, MINUTE)).toBe(0);
    expect(windowFor(MINUTE, MINUTE)).toBe(1);
  });
});

describe("retryAfterFor", () => {
  it("counts the seconds left in the window", () => {
    expect(retryAfterFor(5 * MINUTE, MINUTE)).toBe(60);
    expect(retryAfterFor(5 * MINUTE + 30_000, MINUTE)).toBe(30);
  });

  // "Try again in 0s" is not an instruction, and rounding down at the very
  // end of a window would produce one.
  it("never says zero", () => {
    expect(retryAfterFor(6 * MINUTE - 1, MINUTE)).toBe(1);
    expect(retryAfterFor(6 * MINUTE - 100, MINUTE)).toBe(1);
  });

  it("rounds up, so waiting the stated time is always enough", () => {
    expect(retryAfterFor(5 * MINUTE + 29_500, MINUTE)).toBe(31);
  });

  it("is never longer than the window itself", () => {
    for (let offset = 0; offset < MINUTE; offset += 997) {
      expect(retryAfterFor(5 * MINUTE + offset, MINUTE)).toBeLessThanOrEqual(60);
    }
  });
});
