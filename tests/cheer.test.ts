import { describe, it, expect } from "vitest";
import { cheerFor, type CheerInput } from "@/lib/cheer";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";

function input(over: Partial<CheerInput> = {}): CheerInput {
  return { total: 6, done: 2, overdue: 0, doneToday: 0, elapsed: 0.33, daysToDue: 5, ...over };
}

describe("cheerFor", () => {
  it("says nothing about the ordinary middle of a project", () => {
    // Most days are this. A line every day is a line nobody reads.
    expect(cheerFor(input())).toBeNull();
  });

  it("says nothing at all about an empty project", () => {
    expect(cheerFor(input({ total: 0, done: 0 }))).toBeNull();
  });

  it("counts the days when everything landed early", () => {
    const cheer = cheerFor(input({ done: 6, daysToDue: 4 }));
    expect(cheer).toEqual({ key: "cheerAllDoneEarly", count: 4, good: true });
  });

  it("does not claim early when the date has already passed", () => {
    // Finishing a week late is still finishing, and it still gets a line, but
    // not one that congratulates somebody on being early.
    expect(cheerFor(input({ done: 6, daysToDue: -3 }))?.key).toBe("cheerAllDone");
  });

  it("notices a real day's work", () => {
    const cheer = cheerFor(input({ done: 3, doneToday: 3 }));
    expect(cheer).toEqual({ key: "cheerBurstMany", count: 3, good: true });
  });

  it("mentions a good day even on a project that is behind", () => {
    // The more useful fact about today. Leading with the slippage would be
    // technically true and the wrong thing to say.
    expect(cheerFor(input({ done: 3, doneToday: 3, overdue: 2 }))?.key).toBe("cheerBurstMany");
  });

  it("points at the next move rather than the failure", () => {
    expect(cheerFor(input({ overdue: 2 }))).toEqual({
      key: "cheerBehindMany",
      count: 2,
      good: false,
    });
    expect(cheerFor(input({ overdue: 1 }))?.good).toBe(false);
  });

  it("puts slippage above the milder good news", () => {
    // Halfway would otherwise win here, which is reading the wrong number out
    // while two things sit past their date.
    expect(cheerFor(input({ total: 6, done: 3, overdue: 2 }))?.key).toBe("cheerBehindMany");
  });

  it("only calls it ahead when it is clearly ahead", () => {
    // A project is always slightly one side or the other of its own schedule,
    // so a small margin says nothing.
    expect(cheerFor(input({ done: 2, elapsed: 0.3 }))).toBeNull();
    expect(cheerFor(input({ total: 10, done: 6, elapsed: 0.2 }))?.key).toBe("cheerAhead");
  });

  it("prefers ahead to halfway when both are true", () => {
    // Halfway is a milestone in the work; ahead is a fact about the work
    // against the calendar, and it is the better thing to hear.
    expect(cheerFor(input({ total: 6, done: 3, elapsed: 0.2 }))?.key).toBe("cheerAhead");
  });

  it("says nothing about pace on a project with no dates", () => {
    expect(cheerFor(input({ elapsed: null, daysToDue: null }))).toBeNull();
  });

  it("marks halfway once, on the way past", () => {
    expect(cheerFor(input({ total: 6, done: 3, elapsed: 0.45 }))?.key).toBe("cheerHalfway");
    // Already past it: the moment has been and gone.
    expect(cheerFor(input({ total: 6, done: 4, elapsed: 0.6 }))).toBeNull();
  });

  it("does not announce halfway on a two-item project", () => {
    expect(cheerFor(input({ total: 2, done: 1, elapsed: 0.5 }))?.key).toBe("cheerLastOne");
  });

  it("counts down to the last one", () => {
    expect(cheerFor(input({ total: 6, done: 5 }))?.key).toBe("cheerLastOne");
  });

  it("marks the first tick, on the day it happens", () => {
    expect(cheerFor(input({ done: 1, doneToday: 1 }))?.key).toBe("cheerFirstDone");
    // Days later it is not news any more.
    expect(cheerFor(input({ done: 1, doneToday: 0 }))).toBeNull();
  });

  it("nudges a project that has not started", () => {
    expect(cheerFor(input({ done: 0, elapsed: 0.1 }))?.key).toBe("cheerNotStarted");
  });

  it("stops nudging late in an untouched project, where it would be rubbing it in", () => {
    expect(cheerFor(input({ done: 0, elapsed: 0.9 }))).toBeNull();
  });

  it("gives the same answer every time for the same state", () => {
    // Deterministic on purpose: a random line changes on every render and
    // rewards refreshing the page.
    const state = input({ done: 3, doneToday: 3 });
    expect(cheerFor(state)).toEqual(cheerFor(state));
  });
});

describe("the lines themselves", () => {
  const keys = [
    "cheerAllDoneEarly",
    "cheerAllDone",
    "cheerBurstMany",
    "cheerBurstFew",
    "cheerLastOne",
    "cheerBehindMany",
    "cheerBehindOne",
    "cheerAhead",
    "cheerHalfway",
    "cheerFirstDone",
    "cheerNotStarted",
  ] as const;

  it("exists in both languages", () => {
    for (const key of keys) {
      expect(en.track[key], key).toBeTruthy();
      expect(es.track[key], key).toBeTruthy();
    }
  });

  it("keeps them to one short line", () => {
    // This sits under a number in a card. Two lines of jokes is a paragraph.
    for (const key of keys) {
      expect(en.track[key].length, `${key} in English`).toBeLessThan(60);
      expect(es.track[key].length, `${key} in Spanish`).toBeLessThan(70);
    }
  });

  it("never shouts", () => {
    for (const key of keys) {
      expect(en.track[key], key).not.toContain("!");
      expect(es.track[key], key).not.toContain("!");
    }
  });

  it("has no em dashes", () => {
    for (const key of keys) {
      expect(en.track[key], key).not.toContain("—");
      expect(es.track[key], key).not.toContain("—");
    }
  });

  it("puts a count in every line that is given one", () => {
    for (const key of ["cheerAllDoneEarly", "cheerBurstMany", "cheerBurstFew", "cheerBehindMany"]) {
      expect(en.track[key as (typeof keys)[number]], key).toContain("{count}");
      expect(es.track[key as (typeof keys)[number]], key).toContain("{count}");
    }
  });
});
