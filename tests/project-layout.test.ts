import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * The board is what somebody came to this page for.
 *
 * It was fifth: the header, five stat cards at 19px, a full-width tracker
 * card, a full-width schedule bar, then what was coming up, and only then the
 * work. Every one of those is a glance and the board is the thing you use, so
 * the page was ordered by what was built first rather than by what is looked
 * at.
 */
const detail = readFileSync("src/app/(app)/track/[projectId]/project-detail.tsx", "utf8");
const stats = readFileSync("src/components/track/stat-row.tsx", "utf8");
const timer = readFileSync("src/components/track/timer-button.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

describe("what sits above the board", () => {
  it("puts the clock in the header rather than a band of its own", () => {
    const header = detail.slice(detail.indexOf("<RecordHeader"), detail.indexOf("<StatRow"));
    expect(header).toContain("TimerButton");
  });

  it("keeps the panel, below the board", () => {
    // Still there to be read: the week, the log, the calendar import. Just
    // not between the numbers and the work.
    expect(detail.indexOf("<TimePanel")).toBeGreaterThan(detail.indexOf("t.track.deliverables"));
  });

  it("puts the schedule and what is coming up on one row", () => {
    expect(detail).toContain("lg:grid-cols-[1.5fr_1fr]");
  });

  it("shrinks the figures, which are a glance", () => {
    expect(stats).not.toContain("text-[19px]");
    expect(stats).toContain("text-[15px]");
  });
});

describe("the timer asks once", () => {
  it("breathes on arrival and stops", () => {
    // Anything that pulses forever becomes furniture.
    expect(timer).toContain("animate-pulse-once");
    expect(css).toContain("animation: pulse-once 1.15s ease-in-out 3;");
  });

  it("stops asking once it is running", () => {
    // It has what it wanted at that point.
    const running = timer.slice(timer.indexOf("running\n          ?"));
    expect(running.slice(0, 200)).toContain("bg-ink text-white");
  });

  it("respects somebody who asked for less motion", () => {
    expect(css).toContain("prefers-reduced-motion: reduce");
    const guard = css.slice(css.lastIndexOf("prefers-reduced-motion: reduce"));
    expect(guard).toContain(".animate-pulse-once");
  });

  it("asks what the tracking is for before starting a clock", () => {
    // Otherwise the first press records time against nothing.
    expect(timer).toContain("if (!setUp)");
    expect(timer).toContain("onSetUp()");
  });
});
