import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { busiestSeconds, weekOf, weekSeconds, weekStart, type WeekEntry } from "@/lib/time-week";
import { sayClock, sayDuration, secondsBetween, secondsOf, totals } from "@/lib/time-tracking";

const at = (iso: string, seconds: number, note = ""): WeekEntry => ({
  id: iso,
  startedAt: iso,
  minutes: Math.round(seconds / 60),
  seconds,
  note,
  billable: true,
});

/**
 * Seconds, and a week you can look at.
 *
 * A timer that reports in whole minutes tells somebody who worked for fifty
 * seconds that they worked for nothing, and rounds every session the same way
 * across a month. And a column of durations is a receipt: it says Tuesday had
 * six hours in it and nothing about what they bought.
 */
describe("counting in seconds", () => {
  it("keeps the exact length", () => {
    expect(secondsBetween("2026-09-04T09:00:00Z", "2026-09-04T09:00:50Z")).toBe(50);
  });

  it("reads an old entry that only has minutes", () => {
    // Nothing written before seconds existed is thrown away.
    expect(secondsOf({ minutes: 90 })).toBe(5400);
    expect(secondsOf({ minutes: 90, seconds: 5432 })).toBe(5432);
  });

  it("shows a running clock with its seconds moving", () => {
    // A number that changes once a minute looks stuck.
    expect(sayClock(50)).toBe("0:50");
    expect(sayClock(605)).toBe("10:05");
    expect(sayClock(3725)).toBe("1:02:05");
  });

  it("says a finished stretch as a length, not a stopwatch reading", () => {
    expect(sayDuration(50)).toBe("50s");
    expect(sayDuration(2700)).toBe("45m");
    expect(sayDuration(8100)).toBe("2h 15m");
    expect(sayDuration(7200)).toBe("2h");
  });

  it("adds up in seconds and reports minutes for display", () => {
    const out = totals([
      { minutes: 1, seconds: 50, billable: true, startedAt: "" },
      { minutes: 1, seconds: 70, billable: false, startedAt: "" },
    ]);
    expect(out.seconds).toBe(120);
    expect(out.billableSeconds).toBe(50);
  });
});

describe("the week", () => {
  it("starts on Monday", () => {
    // A layout that puts Saturday in the middle of the working week reads
    // wrong to everyone who is not American.
    const sunday = new Date(2026, 8, 6);
    expect(weekStart(sunday).getDay()).toBe(1);
    const monday = new Date(2026, 8, 7);
    expect(weekStart(monday).getDate()).toBe(7);
  });

  it("always has seven days, including the empty ones", () => {
    // An empty day is the useful part: it is the day nothing got done.
    const days = weekOf([], new Date(2026, 8, 7));
    expect(days).toHaveLength(7);
    expect(days.every((day) => day.seconds === 0)).toBe(true);
  });

  it("puts an entry in the day it started", () => {
    const monday = new Date(2026, 8, 7, 9, 0);
    const days = weekOf([at(monday.toISOString(), 3600)], monday);
    expect(days[0].seconds).toBe(3600);
    expect(days[1].seconds).toBe(0);
  });

  it("keeps a session that runs past midnight on the evening it started", () => {
    // Which is how somebody will look for it.
    const lateTuesday = new Date(2026, 8, 8, 23, 30);
    const days = weekOf([at(lateTuesday.toISOString(), 7200)], lateTuesday);
    expect(days[1].seconds).toBe(7200);
    expect(days[2].seconds).toBe(0);
  });

  it("orders a day's entries by when they happened", () => {
    const day = new Date(2026, 8, 7);
    const later = new Date(2026, 8, 7, 15, 0).toISOString();
    const earlier = new Date(2026, 8, 7, 9, 0).toISOString();
    const days = weekOf([at(later, 60), at(earlier, 60)], day);
    expect(days[0].entries.map((e) => e.startedAt)).toEqual([earlier, later]);
  });

  it("knows the tallest day and the week's total", () => {
    const monday = new Date(2026, 8, 7, 9, 0);
    const wednesday = new Date(2026, 8, 9, 9, 0);
    const days = weekOf(
      [at(monday.toISOString(), 3600), at(wednesday.toISOString(), 7200)],
      monday
    );
    expect(busiestSeconds(days)).toBe(7200);
    expect(weekSeconds(days)).toBe(10800);
  });

  it("marks today, and only today", () => {
    const today = new Date(2026, 8, 9);
    const days = weekOf([], today, today);
    expect(days.filter((day) => day.isToday)).toHaveLength(1);
  });
});

describe("what the hours were spent on", () => {
  const actions = readFileSync("src/actions/time.ts", "utf8");
  const log = readFileSync("src/components/track/time-log.tsx", "utf8");

  it("can be typed, or taken from the deliverables already on the project", () => {
    expect(actions).toContain("logTimeAction");
    expect(log).toContain("deliverables.slice(0, 6)");
  });

  it("writes the deliverable's name into the line as well as the link", () => {
    // Otherwise the log reads as a column of references rather than sentences.
    expect(log).toContain("note: deliverable.name");
  });

  it("only accepts a deliverable from the same project", () => {
    // The id arrives from a client and could point anywhere.
    expect(actions).toContain("where: { id: input.deliverableId, projectId: entry.projectId }");
  });

  it("keeps a very short session rather than a misclick", () => {
    // A minute threw away the shortest real thing anybody does.
    expect(actions).toContain("secondsOf(stopped) < 10");
  });
});

describe("how the panel behaves", () => {
  const panel = readFileSync("src/components/track/time-panel.tsx", "utf8");

  it("is one line until it is wanted", () => {
    // It was a card the height of the schedule, open on every project whether
    // or not anybody tracked time, which is most projects.
    expect(panel).toContain("setOpen((o) => !o)");
    expect(panel).toContain("aria-expanded={open}");
  });

  it("can be stopped without opening it", () => {
    // A timer you have to go looking for is a timer that runs all night.
    const closedPart = panel.slice(0, panel.indexOf("{open && ("));
    expect(closedPart).toContain("stopTimerAction()");
  });

  it("asks what you are doing before the timer starts", () => {
    /**
     * Afterwards it is a question about something already finished, and the
     * honest answer by then is often that nobody remembers, which is how a
     * week of tracked time becomes a column of durations against nothing.
     */
    expect(panel).toContain("t.track.whatAreYouDoing");
    expect(panel).toContain("startTimerAction(projectId, what.trim())");
  });

  it("shows what a running timer is for", () => {
    expect(panel).toContain("running.note");
  });

  it("lets the answer be changed later", () => {
    // A job tracked privately becomes one the client is billed for.
    expect(panel).toContain("t.track.timeChangeUse");
    const setUp = readFileSync("src/components/track/time-set-up.tsx", "utf8");
    expect(setUp).toContain("current && current !== \"OFF\" ? current : \"RECORD\"");
  });


  it("ticks every second while something is running", () => {
    expect(panel).toContain("setNow(Date.now()), 1000)");
  });

  it("stops ticking when nothing is", () => {
    // An idle project page should not re-render once a second forever.
    expect(panel).toContain("if (!running) return;");
  });

  it("reads as a clock while running and a length once stopped", () => {
    expect(panel).toContain("running ? sayClock(totalSeconds) : sayDuration(totalSeconds)");
  });
});
