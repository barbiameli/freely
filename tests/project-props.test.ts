import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * The board and the timeline get the fields they are made of.
 *
 * track/[projectId]/page.tsx has two branches: DiaryView for the client's
 * view, ProjectDetail for the working one. Three separate times a field was
 * added to the first and not the second, and the second is the one with the
 * board and the timeline in it.
 *
 * The result was silent and total. Every card arrived with no startedAt and
 * sat in To do whatever the database said. Every task arrived with no
 * plannedStart and showed as unplaced however many times the planner ran.
 * Both features wrote correctly the whole time; nothing they wrote reached
 * the screen, so three rounds of fixes went into code that was already right.
 *
 * A grep is a poor substitute for types here, and it is what there is: the
 * two branches build object literals against interfaces that both accept
 * optional fields, so leaving one out compiles.
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

describe("the two branches", () => {
  it("both exist, so neither can be assumed", () => {
    // If this ever fails the file has been restructured and the guard above
    // is measuring the wrong half of it.
    expect(page).toContain("<DiaryView");
    expect(page).toContain("<ProjectDetail");
    expect(page.indexOf("<DiaryView")).toBeLessThan(page.indexOf("<ProjectDetail"));
  });
});
