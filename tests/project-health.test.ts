import { describe, it, expect } from "vitest";
import {
  deliverableCompletion,
  projectCompletion,
  pace,
  upcomingDeadlines,
  frictionPoints,
  prioritize,
  type HealthProject,
} from "@/lib/project-health";
import {
  stageEndWeek,
  scheduleStages,
  scheduleDeliverables,
  daysBetween,
  addDays,
  relativeDay,
} from "@/lib/schedule";

const START = new Date("2026-01-01T00:00:00Z");

function project(overrides: Partial<HealthProject> = {}): HealthProject {
  return {
    id: "p1",
    title: "Design system",
    client: "Acme",
    status: "ACTIVE",
    startDate: START,
    dueDate: addDays(START, 28),
    deliverables: [],
    ...overrides,
  };
}

function deliverable(done: boolean, steps: [boolean, number][] = [], dueAt: Date | null = null) {
  return {
    id: Math.random().toString(36).slice(2),
    name: "Foundations in Figma",
    done,
    dueAt,
    steps: steps.map(([d, estimateHours]) => ({ done: d, estimateHours })),
  };
}

describe("completion", () => {
  it("weights steps by their estimate", () => {
    // One eight-hour step done out of nine hours of work is most of it, even
    // though it is one box out of two.
    const d = deliverable(false, [
      [true, 8],
      [false, 1],
    ]);
    expect(deliverableCompletion(d)).toBeCloseTo(8 / 9);
  });

  it("counts unestimated steps equally", () => {
    expect(deliverableCompletion(deliverable(false, [[true, 0], [false, 0]]))).toBe(0.5);
  });

  it("treats a hand-ticked deliverable as finished whatever its steps say", () => {
    expect(deliverableCompletion(deliverable(true, [[false, 5]]))).toBe(1);
  });

  it("falls back to done/not done with no steps", () => {
    expect(deliverableCompletion(deliverable(false))).toBe(0);
    expect(deliverableCompletion(deliverable(true))).toBe(1);
  });

  it("averages across deliverables", () => {
    const p = project({ deliverables: [deliverable(true), deliverable(false)] });
    expect(projectCompletion(p)).toBe(0.5);
  });
});

describe("pace", () => {
  it("says nothing when the project has no dates", () => {
    expect(pace(project({ startDate: null, dueDate: null }))).toBe("unscheduled");
  });

  it("tolerates a small gap, because freelance work is lumpy", () => {
    // Week one of four gone, nothing ticked: a 25% gap would be behind on a
    // strict reading, but early research produces no ticked boxes.
    const p = project({ deliverables: [deliverable(false), deliverable(false)] });
    expect(pace(p, addDays(START, 3))).toBe("on track");
  });

  it("calls it behind when most of the time is gone and little is done", () => {
    const p = project({ deliverables: [deliverable(false), deliverable(false)] });
    expect(pace(p, addDays(START, 25))).toBe("behind");
  });

  it("calls it ahead when the work is well past the calendar", () => {
    const p = project({ deliverables: [deliverable(true), deliverable(true)] });
    expect(pace(p, addDays(START, 7))).toBe("on track");
  });
});

describe("deadlines", () => {
  it("ignores finished and dateless deliverables", () => {
    const p = project({
      deliverables: [
        deliverable(true, [], addDays(START, 2)),
        deliverable(false),
        deliverable(false, [], addDays(START, 5)),
      ],
    });
    expect(upcomingDeadlines(p, START)).toHaveLength(1);
  });

  it("puts overdue first and marks it", () => {
    const p = project({
      deliverables: [
        deliverable(false, [], addDays(START, 5)),
        deliverable(false, [], addDays(START, -2)),
      ],
    });
    const [first] = upcomingDeadlines(p, START);
    expect(first.overdue).toBe(true);
    expect(first.daysAway).toBe(-2);
  });
});

describe("friction", () => {
  it("reports overdue work and blocking questions", () => {
    const p = project({ deliverables: [deliverable(false, [], addDays(START, -3))] });
    const points = frictionPoints(p, 2, START);
    expect(points.some((f) => f.title.includes("past the date"))).toBe(true);
    expect(points.some((f) => f.title.includes("unanswered"))).toBe(true);
  });

  it("stays quiet on a healthy project", () => {
    const p = project({ deliverables: [deliverable(true, [[true, 1]], addDays(START, 5))] });
    expect(frictionPoints(p, 0, addDays(START, 2))).toEqual([]);
  });
});

describe("prioritize", () => {
  it("puts overdue work above everything and sinks finished projects", () => {
    const late = project({
      id: "late",
      deliverables: [deliverable(false, [], addDays(START, -4))],
    });
    const finished = project({ id: "finished", status: "DONE", deliverables: [deliverable(true)] });
    const fine = project({
      id: "fine",
      deliverables: [deliverable(true), deliverable(false, [], addDays(START, 20))],
    });

    const ranked = prioritize([finished, fine, late], {}, addDays(START, 2));
    expect(ranked[0].projectId).toBe("late");
    expect(ranked[ranked.length - 1].projectId).toBe("finished");
    expect(ranked[0].reason).toContain("past the date");
  });

  it("says a project ahead of schedule can wait", () => {
    const ahead = project({ id: "ahead", deliverables: [deliverable(true), deliverable(true)] });
    const [only] = prioritize([ahead], {}, addDays(START, 3));
    expect(only.reason).toContain("Finished");
  });
});

describe("schedule", () => {
  it("reads the last week out of a stage label", () => {
    expect(stageEndWeek("Week 1-2")).toBe(2);
    expect(stageEndWeek("Week 3")).toBe(3);
    expect(stageEndWeek("Ongoing")).toBeNull();
  });

  it("places stages at the end of their last week", () => {
    const stages = scheduleStages(
      "Week 1-2: Discovery - interviews\nWeek 3-4: Design - concepts",
      START
    );
    expect(stages).toHaveLength(2);
    expect(daysBetween(START, stages[0].dueAt)).toBe(14);
    expect(daysBetween(START, stages[1].dueAt)).toBe(28);
  });

  it("spreads deliverables across the span, finishing on the end date", () => {
    const dates = scheduleDeliverables(4, START, addDays(START, 28));
    expect(dates).toHaveLength(4);
    expect(daysBetween(START, dates[0])).toBe(7);
    expect(daysBetween(START, dates[3])).toBe(28);
  });

  it("reads dates as relative days", () => {
    expect(relativeDay(START, START)).toBe("today");
    expect(relativeDay(addDays(START, 1), START)).toBe("tomorrow");
    expect(relativeDay(addDays(START, 3), START)).toBe("in 3 days");
    expect(relativeDay(addDays(START, -3), START)).toBe("3 days ago");
    expect(relativeDay(addDays(START, 21), START)).toBe("in 3 weeks");
  });
});
