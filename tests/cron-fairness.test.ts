import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The daily run has sixty seconds and three queries per person.
 *
 * None of this matters at ten users and all of it matters at a thousand, which
 * is exactly the kind of bug that ships: it works on the day it is written and
 * fails quietly on a morning nobody is watching.
 */
const cron = readFileSync("src/app/api/cron/nudges/route.ts", "utf8");

describe("the nudge run", () => {
  it("reads the five columns it uses rather than every row entire", () => {
    expect(cron).toContain("select: {");
    expect(cron).toContain("nudgeEmails: true");
  });

  it("skips people who turned nudges off in the query, not in the loop", () => {
    expect(cron).toContain("where: { nudgeEmails: true }");
  });

  /**
   * The fairness part. Unordered plus a time limit means the tail of the list
   * is never reached, and it is the same tail every morning.
   */
  it("takes whoever has waited longest first", () => {
    expect(cron).toContain('lastNudgeAt: { sort: "asc", nulls: "first" }');
  });

  it("caps a run, so it finishes rather than being cut off mid-person", () => {
    expect(cron).toContain("take: RUN_LIMIT");
    expect(cron).toMatch(/const RUN_LIMIT = \d+/);
  });

  it("still refuses to run without its secret", () => {
    expect(cron).toContain("CRON_SECRET is not set");
    expect(cron).toContain("Bearer ${secret}");
  });
});
