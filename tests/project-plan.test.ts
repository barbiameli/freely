import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  DEFAULT_SHAPE,
  daysShort,
  firstPlan,
  shareOutDays,
  spreadTasks,
  squeezed,
  workingDaysIn,
  type PlannableDeliverable,
  type PlannableTask,
} from "@/lib/project-plan";

// Monday 7 September to Friday 18 September 2026: ten working days.
const START = "2026-09-07";
const END = "2026-09-18";

function task(over: Partial<PlannableTask> = {}): PlannableTask {
  return { id: "t", deliverableId: "d1", estimateHours: 6, order: 0, done: false, ...over };
}

function deliverable(over: Partial<PlannableDeliverable> = {}): PlannableDeliverable {
  return { id: "d1", order: 0, priority: 1, ...over };
}

describe("the working days in a window", () => {
  it("counts the window rather than a number of days from the start", () => {
    expect(workingDaysIn(START, END, [1, 2, 3, 4, 5])).toHaveLength(10);
  });

  it("leaves out the weekend", () => {
    const days = workingDaysIn(START, END, [1, 2, 3, 4, 5]);
    expect(days.every((day) => day.getUTCDay() !== 0 && day.getUTCDay() !== 6)).toBe(true);
  });

  it("believes somebody who works Saturdays", () => {
    // One Saturday falls inside 7 to 18 September.
    expect(workingDaysIn(START, END, [1, 2, 3, 4, 5, 6])).toHaveLength(11);
  });

  it("gives nothing back when the dates are the wrong way round", () => {
    expect(workingDaysIn(END, START, [1, 2, 3, 4, 5])).toEqual([]);
  });
});

describe("sharing the days out", () => {
  const six = Array.from({ length: 6 }, (_, i) => deliverable({ id: `d${i}`, order: i }));
  const tasks = six.map((d, i) => task({ id: `t${i}`, deliverableId: d.id }));

  it("adds up to the window, not to one less", () => {
    const share = shareOutDays(six, tasks, 10);
    const total = Array.from(share.values()).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(10);
  });

  it("gives a starred deliverable more of the time", () => {
    const starred = six.map((d, i) => (i === 0 ? { ...d, priority: 2 } : d));
    const share = shareOutDays(starred, tasks, 10);
    expect(share.get("d0")!).toBeGreaterThan(share.get("d1")!);
  });

  it("takes those days from the others rather than lengthening the project", () => {
    // The end date was agreed with a client. The only real question is where
    // the time goes inside the window.
    const starred = six.map((d, i) => (i === 0 ? { ...d, priority: 2 } : d));
    const total = Array.from(shareOutDays(starred, tasks, 10).values()).reduce((a, b) => a + b, 0);
    expect(total).toBe(10);
  });

  it("never rounds a deliverable out of existence", () => {
    // A deliverable allocated nothing is one that silently left the plan.
    const share = shareOutDays(six, tasks, 6);
    for (const d of six) expect(share.get(d.id)!).toBeGreaterThanOrEqual(1);
  });

  it("ignores deliverables whose work is finished", () => {
    const done = tasks.map((t, i) => (i === 0 ? { ...t, done: true } : t));
    expect(shareOutDays(six, done, 10).has("d0")).toBe(false);
  });

  it("says nothing about a window with no days in it", () => {
    expect(shareOutDays(six, tasks, 0).size).toBe(0);
  });
});

describe("the first plan", () => {
  const three = [
    deliverable({ id: "a", order: 0 }),
    deliverable({ id: "b", order: 1 }),
    deliverable({ id: "c", order: 2 }),
  ];
  const tasks = [
    task({ id: "a1", deliverableId: "a", order: 0 }),
    task({ id: "a2", deliverableId: "a", order: 1 }),
    task({ id: "b1", deliverableId: "b", order: 0 }),
    task({ id: "c1", deliverableId: "c", order: 0 }),
  ];

  it("places every unfinished task", () => {
    const plan = firstPlan(three, tasks, START, END);
    expect(plan.map((p) => p.id).sort()).toEqual(["a1", "a2", "b1", "c1"]);
  });

  it("keeps the deliverables in the order they were agreed", () => {
    const plan = firstPlan(three, tasks, START, END);
    const first = plan.find((p) => p.id === "a1")!;
    const last = plan.find((p) => p.id === "c1")!;
    expect(first.start.getTime()).toBeLessThan(last.start.getTime());
  });

  it("never places anything on a day nobody works", () => {
    const plan = firstPlan(three, tasks, START, END);
    for (const placement of plan) {
      expect([1, 2, 3, 4, 5]).toContain(placement.start.getUTCDay());
      expect([1, 2, 3, 4, 5]).toContain(placement.end.getUTCDay());
    }
  });

  it("stays inside the window", () => {
    const plan = firstPlan(three, tasks, START, END);
    for (const placement of plan) {
      expect(placement.end.getTime()).toBeLessThanOrEqual(new Date(`${END}T00:00:00Z`).getTime());
    }
  });

  it("has nothing to draw without a window", () => {
    expect(firstPlan(three, tasks, END, START)).toEqual([]);
  });
});

describe("whether it fits at all", () => {
  it("says nothing when it does", () => {
    expect(daysShort([task({ estimateHours: 6 })], START, END, DEFAULT_SHAPE)).toBe(0);
  });

  it("counts the days it is short", () => {
    // 90 hours at six a day is fifteen days, against ten in the window.
    expect(daysShort([task({ estimateHours: 90 })], START, END, DEFAULT_SHAPE)).toBe(5);
  });

  it("believes a longer day", () => {
    const long = { workingDays: [1, 2, 3, 4, 5], hoursPerDay: 12 };
    expect(daysShort([task({ estimateHours: 90 })], START, END, long)).toBe(0);
  });

  it("does not count work already finished", () => {
    expect(daysShort([task({ estimateHours: 90, done: true })], START, END)).toBe(0);
  });
});


describe("a project starts planned, not blank", () => {
  const detail = readFileSync("src/app/(app)/track/[projectId]/project-detail.tsx", "utf8");
  const setup = readFileSync("src/components/track/plan-setup.tsx", "utf8");

  it("asks for the shape before showing an empty grid", () => {
    expect(detail).toContain("(!project.plannedAt || replanning) && allSteps.length > 0");
    expect(detail).toContain("<PlanSetup");
  });

  it("asks once, then stays reachable", () => {
    // plannedAt records that it has been answered. It used to hide the panel
    // forever, which is wrong for the things it holds: a client moves a date,
    // a deliverable turns out to be twice the work, somebody drops to three
    // days a week.
    expect(detail).toContain("project.plannedAt");
    expect(detail).toContain("setReplanning(true)");
  });

  it("has a defensible default for all four", () => {
    // Somebody who agrees with everything presses one button.
    expect(setup).toContain('useState("6")');
    expect(setup).toContain("useState<number[]>([1, 2, 3, 4, 5])");
  });

  it("drops the list view", () => {
    // Three ways to read one thing was one too many.
    expect(detail).not.toContain("t.track.viewList");
    expect(detail).toContain('useState<"board" | "timeline">');
  });
});

describe("what got squeezed", () => {
  const six = Array.from({ length: 3 }, (_, i) => deliverable({ id: `d${i}`, order: i }));
  const tasks = six.map((d, i) => task({ id: `t${i}`, deliverableId: d.id, estimateHours: 30 }));

  it("names the deliverables given less time than their work needs", () => {
    // The plan always fits the window, so the useful sentence is which
    // corners were cut to get there.
    const allocation = shareOutDays(six, tasks, 6);
    const tight = squeezed(six, tasks, allocation, 6);
    expect(tight.length).toBeGreaterThan(0);
    expect(tight[0].needs).toBeGreaterThan(tight[0].has);
  });

  it("says nothing when everything has room", () => {
    const easy = six.map((d, i) => task({ id: `e${i}`, deliverableId: d.id, estimateHours: 3 }));
    expect(squeezed(six, easy, shareOutDays(six, easy, 30), 6)).toEqual([]);
  });

  it("squeezes a starred deliverable last", () => {
    // The entire point of the star: it says which corners may be cut.
    const starred = six.map((d, i) => (i === 0 ? { ...d, priority: 2 } : d));
    const allocation = shareOutDays(starred, tasks, 9);
    expect(allocation.get("d0")!).toBeGreaterThanOrEqual(allocation.get("d1")!);
  });
});

describe("how long each task's bar is", () => {
  it("gives a longer task a longer bar", () => {
    // Cutting the days into equal pieces gave a six-hour task and a one-hour
    // task identical bars, so the chart said nothing about where the work
    // was: a fortnight of thirty-one identical pills is a list drawn on a
    // calendar.
    const spans = spreadTasks(
      [
        task({ id: "big", estimateHours: 18 }),
        task({ id: "small", estimateHours: 2 }),
      ],
      6,
      6
    );
    const big = spans.find((s) => s.id === "big")!;
    const small = spans.find((s) => s.id === "small")!;
    expect(big.to - big.from).toBeGreaterThan(small.to - small.from);
  });

  it("never gives a task less than a day", () => {
    const spans = spreadTasks(
      [task({ id: "a", estimateHours: 0.25 }), task({ id: "b", estimateHours: 0.25 })],
      4,
      6
    );
    for (const span of spans) expect(span.to).toBeGreaterThanOrEqual(span.from);
  });

  it("runs them one after another rather than on top of each other", () => {
    const spans = spreadTasks(
      [
        task({ id: "a", estimateHours: 6 }),
        task({ id: "b", estimateHours: 6 }),
        task({ id: "c", estimateHours: 6 }),
      ],
      6,
      6
    );
    expect(spans[1].from).toBeGreaterThan(spans[0].to);
    expect(spans[2].from).toBeGreaterThan(spans[1].to);
  });

  it("does not stretch bars to fill days the work does not need", () => {
    // A deliverable given more days than its work needs should not have its
    // bars inflated: that is a claim about how long the work takes.
    const spans = spreadTasks([task({ id: "a", estimateHours: 6 })], 10, 6);
    expect(spans[0].to - spans[0].from).toBe(0);
  });

  it("scales everything down together when there is not enough room", () => {
    const spans = spreadTasks(
      [
        task({ id: "a", estimateHours: 30 }),
        task({ id: "b", estimateHours: 30 }),
      ],
      4,
      6
    );
    for (const span of spans) expect(span.to).toBeLessThan(4);
  });

  it("keeps everything inside the deliverable's own days", () => {
    // Otherwise a deliverable overruns into the next one's time and the whole
    // plan slides without saying so.
    const many = Array.from({ length: 8 }, (_, i) =>
      task({ id: `t${i}`, estimateHours: 12, order: i })
    );
    for (const span of spreadTasks(many, 3, 6)) {
      expect(span.from).toBeLessThan(3);
      expect(span.to).toBeLessThan(3);
    }
  });

  it("has nothing to place in no days", () => {
    expect(spreadTasks([task()], 0, 6)).toEqual([]);
  });
});
