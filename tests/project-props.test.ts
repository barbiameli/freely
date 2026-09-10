import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * The board and the timeline get the fields they are made of.
 *
 * track/[projectId]/page.tsx used to have two branches: DiaryView for the
 * client's view, ProjectDetail for the working one. Three separate times a
 * field was added to the first and not the second, and the second is the one
 * with the board and the timeline in it.
 *
 * The result was silent and total. Every card arrived with no startedAt and
 * sat in To do whatever the database said. Every task arrived with no
 * plannedStart and showed as unplaced however many times the planner ran.
 * Both features wrote correctly the whole time; nothing they wrote reached
 * the screen, so three rounds of fixes went into code that was already right.
 *
 * The client branch has since moved to the client page, so there is one
 * branch and the trap is gone. The field checks stay: they are cheap, and the
 * object literal is still built against an interface of optional fields, so
 * leaving one out still compiles and still fails silently at runtime.
 */
const page = readFileSync("src/app/(app)/track/[projectId]/page.tsx", "utf8");

/** Everything after the ProjectDetail branch begins. */
const detailBranch = page.slice(page.indexOf("<ProjectDetail"));

describe("the working view is given its data", () => {
  for (const field of ["order", "startedAt", "plannedStart", "plannedEnd", "estimateHours"]) {
    it(`passes ${field} to ProjectDetail`, () => {
      expect(detailBranch).toContain(`${field}:`);
    });
  }

  it("passes which card the clock is on", () => {
    // Without it the board shows a play on the card that is already running.
    expect(detailBranch).toContain("stepId:");
  });

  it("passes whether the project has been planned", () => {
    // Without it the setup panel asks again on every visit, or never.
    expect(detailBranch).toContain("plannedAt:");
  });
});

describe("one branch", () => {
  it("has no second view to fall out of step with", () => {
    // The whole reason the guard above exists. If a second branch is ever
    // added here, the fields have two places to be kept in sync again and
    // this test should be turned back into the pair it used to check.
    expect(page).toContain("<ProjectDetail");
    expect(page).not.toContain("<DiaryView");
  });
});
