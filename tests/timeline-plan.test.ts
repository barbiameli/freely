import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  autoSchedule,
  barFor,
  dayColumns,
  daysBetween,
  dayKey,
  daysNeeded,
  fitPerDeliverable,
  overrunDays,
  packLanes,
  whatToDoAbout,
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

  it("makes it fit and says what got squeezed", () => {
    // Laying the tasks end to end and reporting "21 working days past the due
    // date" is true and useless: the date was agreed with a client, so
    // running past it is not a plan, it is a description of a problem.
    expect(action).toContain("firstPlan(deliverables, tasks, row.startDate, row.dueDate, shape)");
    expect(action).toContain("squeezed(deliverables, tasks, allocation");
    expect(chart).toContain("t.track.timelineSqueezed");
  });

  it("folds the unplaced list away", () => {
    // Thirty pills above a two-week grid is a list with a chart underneath
    // it, which is the wrong way round.
    expect(chart).toContain("<details");
    expect(chart).toContain("t.track.timelineUnplacedCount");
  });
});

describe("whether each deliverable fits its own date", () => {
  // Two tasks of a day each, on a deliverable due the day after the start.
  const tasks = [
    task({ id: "one", estimateHours: 6, order: 0 }),
    task({ id: "two", estimateHours: 6, order: 1 }),
  ];

  it("measures per deliverable, not just for the project", () => {
    // A project that lands on time with its first deliverable a week late has
    // already let the client down once.
    const plan = autoSchedule(tasks, MONDAY);
    // Two days of work against a deadline on the first of them.
    const fits = fitPerDeliverable(tasks, plan, MONDAY, new Map([["d1", MONDAY]]));
    expect(fits).toHaveLength(1);
    expect(fits[0].over).toBe(1);
  });

  it("says nothing about a deliverable with no date", () => {
    const plan = autoSchedule(tasks, MONDAY);
    expect(fitPerDeliverable(tasks, plan, MONDAY, new Map())).toEqual([]);
  });

  it("is quiet when the work fits", () => {
    const plan = autoSchedule(tasks, MONDAY);
    const fits = fitPerDeliverable(tasks, plan, MONDAY, new Map([["d1", "2026-09-30"]]));
    expect(fits[0].over).toBe(0);
  });
});

describe("what to do about work that does not fit", () => {
  it("says nothing when it fits", () => {
    expect(whatToDoAbout([{ deliverableId: "d1", over: 0, needs: 3, has: 10 }])).toBe("fits");
  });

  it("suggests trimming when it is close", () => {
    expect(whatToDoAbout([{ deliverableId: "d1", over: 1, needs: 11, has: 10 }])).toBe("trim");
  });

  it("says it has to be rougher when it is not close", () => {
    // Half again over is not something taking one task out fixes, and
    // pretending otherwise is how the fortnight disappears.
    expect(whatToDoAbout([{ deliverableId: "d1", over: 8, needs: 18, has: 10 }])).toBe("roughen");
  });

  it("does not divide by a deliverable with no room at all", () => {
    expect(whatToDoAbout([{ deliverableId: "d1", over: 4, needs: 4, has: 0 }])).toBe("trim");
  });
});

describe("the chart's shape", () => {
  const chart = readFileSync("src/components/track/timeline.tsx", "utf8");
  const board = readFileSync("src/components/track/board.tsx", "utf8");

  it("spends no width on a column of names", () => {
    // 160px repeating what the bar's own colour already said.
    expect(chart).not.toContain('w-[160px]');
  });

  it("draws a row per task rather than per deliverable", () => {
    // Rows sized by deliverable left tall empty bands wherever that
    // deliverable's tasks had not been placed.
    expect(chart).toContain("placed.map((task)");
  });

  it("refreshes after a change, in both views", () => {
    // revalidatePath marks the server cache stale; it does not re-render a
    // client component already on screen. Without this the move was saved and
    // the card sprang back, which reads as drag and drop not working.
    expect(board).toContain("router.refresh()");
    expect(chart).toContain("router.refresh()");
  });
});

describe("bars sharing rows", () => {
  it("puts two bars that do not overlap on one row", () => {
    // A row per task drew a thirty-row staircase across a fortnight, mostly
    // empty. The vertical axis carries no meaning of its own here, so a row
    // per bar spends the one dimension that was free.
    const lanes = packLanes([
      { id: "a", offset: 0, days: 2 },
      { id: "b", offset: 3, days: 2 },
    ]);
    expect(lanes).toHaveLength(1);
    expect(lanes[0].map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("gives overlapping bars their own rows", () => {
    const lanes = packLanes([
      { id: "a", offset: 0, days: 4 },
      { id: "b", offset: 1, days: 2 },
    ]);
    expect(lanes).toHaveLength(2);
  });

  it("lets a bar start the day the last one ended", () => {
    // A bar of two days at offset 0 occupies 0 and 1, so offset 2 is free.
    expect(packLanes([
      { id: "a", offset: 0, days: 2 },
      { id: "b", offset: 2, days: 1 },
    ])).toHaveLength(1);
  });

  it("lays the same plan out the same way twice", () => {
    // A bar jumping rows because another one moved is the chart losing its
    // place under somebody.
    const bars = [
      { id: "c", offset: 4, days: 1 },
      { id: "a", offset: 0, days: 2 },
      { id: "b", offset: 1, days: 3 },
    ];
    const first = packLanes(bars).map((lane) => lane.map((b) => b.id));
    const again = packLanes(bars.slice().reverse()).map((lane) => lane.map((b) => b.id));
    expect(first).toEqual(again);
  });

  it("has nothing to pack when nothing is placed", () => {
    expect(packLanes([])).toEqual([]);
  });
});

describe("the chart uses the width it has", () => {
  const chart = readFileSync("src/components/track/timeline.tsx", "utf8");

  it("lets the days stretch rather than fixing them at 44px", () => {
    // Twelve fixed columns drew a narrow strip down the left of a wide screen
    // and truncated every label to two characters.
    expect(chart).not.toContain("const DAY_WIDTH");
    expect(chart).toContain("minmax(56px, 1fr)");
  });

  it("packs the bars into lanes", () => {
    expect(chart).toContain("packLanes(");
  });
});

