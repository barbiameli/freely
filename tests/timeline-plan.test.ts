import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  autoSchedule,
  barFor,
  dayColumns,
  daysBetween,
  dayKey,
  daysNeeded,
  overrunDays,
  type PlannedTask,
} from "@/lib/timeline-plan";

// A Monday, so weekend handling is visible rather than accidental.
const MONDAY = "2026-09-07";

function task(over: Partial<PlannedTask> = {}): PlannedTask {
  return {
    id: "a",
    name: "Draft new screens",
    deliverableId: "d1",
    estimateHours: 6,
    order: 0,
    done: false,
    plannedStart: null,
    plannedEnd: null,
    ...over,
  };
}

describe("the chart's columns", () => {
  it("draws one per day, both ends included", () => {
    expect(dayColumns("2026-09-07", "2026-09-09")).toHaveLength(3);
  });

  it("survives a one-day project", () => {
    expect(dayColumns(MONDAY, MONDAY)).toHaveLength(1);
  });

  it("does not go backwards on a due date before the start", () => {
    expect(dayColumns("2026-09-09", "2026-09-07")).toHaveLength(1);
  });
});

describe("a bar", () => {
  it("is null until the task has been placed", () => {
    expect(barFor(task(), MONDAY)).toBeNull();
    expect(barFor(task({ plannedStart: MONDAY }), MONDAY)).toBeNull();
  });

  it("is never invisible", () => {
    // Start and end on the same day is one day wide, not zero.
    const same = task({ plannedStart: MONDAY, plannedEnd: MONDAY });
    expect(barFor(same, MONDAY)).toEqual({ id: "a", offset: 0, days: 1 });
  });

  it("sits where it was placed", () => {
    const later = task({ plannedStart: "2026-09-09", plannedEnd: "2026-09-10" });
    expect(barFor(later, MONDAY)).toEqual({ id: "a", offset: 2, days: 2 });
  });
});

describe("how much room a task needs", () => {
  it("rounds a part day up", () => {
    // Two hours still occupies a day you cannot give to something else.
    expect(daysNeeded(2)).toBe(1);
    expect(daysNeeded(7)).toBe(2);
    expect(daysNeeded(12)).toBe(2);
  });

  it("gives an unestimated task a day rather than nothing", () => {
    // A zero-width bar is a task that has silently left the plan.
    expect(daysNeeded(0)).toBe(1);
  });
});

describe("planning the whole project", () => {
  const tasks = [
    task({ id: "second", order: 1, estimateHours: 6 }),
    task({ id: "first", order: 0, estimateHours: 6 }),
    task({ id: "other", deliverableId: "d2", order: 0, estimateHours: 6 }),
  ];

  it("follows the order that was agreed", () => {
    const plan = autoSchedule(tasks, MONDAY, ["d1", "d2"]);
    expect(plan.map((p) => p.id)).toEqual(["first", "second", "other"]);
  });

  it("never runs two things at once", () => {
    // One freelancer cannot do two things at once, and a chart that pretends
    // otherwise is how a fortnight fits into a week on paper.
    const plan = autoSchedule(tasks, MONDAY, ["d1", "d2"]);
    for (let i = 1; i < plan.length; i += 1) {
      expect(plan[i].start.getTime()).toBeGreaterThan(plan[i - 1].end.getTime());
    }
  });

  it("skips the weekend", () => {
    const long = [task({ id: "big", estimateHours: 30 })];
    const [placed] = autoSchedule(long, MONDAY);
    // Five working days from Monday ends on the Friday, not the Wednesday.
    expect(placed.end.getDay()).toBe(5);
  });

  it("leaves finished work out rather than scheduling it into the past", () => {
    const plan = autoSchedule([task({ id: "done", done: true }), task({ id: "todo" })], MONDAY);
    expect(plan.map((p) => p.id)).toEqual(["todo"]);
  });

  it("gives the same answer twice", () => {
    // A plan that shifts between two presses of the same button is not a plan.
    const a = autoSchedule(tasks, MONDAY, ["d1", "d2"]);
    const b = autoSchedule(tasks, MONDAY, ["d1", "d2"]);
    expect(a.map((p) => p.start.toISOString())).toEqual(b.map((p) => p.start.toISOString()));
  });
});

describe("whether it fits", () => {
  it("says nothing when it does", () => {
    const plan = autoSchedule([task({ estimateHours: 6 })], MONDAY);
    expect(overrunDays(plan, "2026-09-30")).toBe(0);
  });

  it("says by how much when it does not", () => {
    // Overrunning is the answer when the work does not fit, and squeezing the
    // bars to hide it is the one thing this view exists to prevent.
    const plan = autoSchedule([task({ estimateHours: 60 })], MONDAY);
    expect(overrunDays(plan, "2026-09-11")).toBeGreaterThan(0);
  });

  it("has nothing to say about an unscheduled project", () => {
    expect(overrunDays([], null)).toBe(0);
  });
});

describe("counting days", () => {
  it("ignores the clock", () => {
    expect(daysBetween("2026-09-07T23:00:00Z", "2026-09-08T01:00:00Z")).toBe(1);
  });

  it("puts a task on the same column wherever it is opened", () => {
    // These are dates, not instants. Read with local getters, a task stored
    // as midnight on the 8th lands on the 7th for anybody west of Greenwich,
    // so the same plan drew a column to the left depending on where you were.
    const stored = new Date("2026-09-08T00:00:00.000Z");
    expect(dayKey(stored)).toBe("2026-09-08");
    expect(daysBetween("2026-09-07T00:00:00.000Z", stored)).toBe(1);
  });

  it("places a bar off a stored timestamp without drifting", () => {
    const placed = task({
      plannedStart: "2026-09-09T00:00:00.000Z",
      plannedEnd: "2026-09-09T00:00:00.000Z",
    });
    expect(barFor(placed, "2026-09-07T00:00:00.000Z")).toEqual({ id: "a", offset: 2, days: 1 });
  });
});


describe("the chart on the page", () => {
  const chart = readFileSync("src/components/track/timeline.tsx", "utf8");
  const action = readFileSync("src/actions/board.ts", "utf8");

  it("shows work that overruns rather than cropping it", () => {
    // The span runs to whichever is later, the due date or the last bar. A
    // chart that stops at the due date hides the exact thing it is for.
    expect(chart).toContain("[dueDate, lastPlanned]");
  });

  it("lists anything not yet placed", () => {
    // A task can otherwise be left out of the plan by being invisible.
    expect(chart).toContain("t.track.timelineUnplaced");
  });

  it("says plainly when there is no start date to draw against", () => {
    expect(chart).toContain("t.track.timelineNeedsDates");
  });

  it("stores a placement as a whole day, not a moment", () => {
    expect(action).toContain('`${startDay}T00:00:00.000Z`');
  });

  it("refuses a bar that ends before it starts", () => {
    // Dragging the left edge past the right would store a negative span and
    // draw nothing at all.
    expect(action).toContain("end < start ? [end, start] : [start, end]");
  });

  it("says whether the plan fits after laying it out", () => {
    expect(action).toContain("overrunDays(plan,");
    expect(chart).toContain("t.track.timelineOverruns");
  });
});
