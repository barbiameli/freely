import { describe, it, expect } from "vitest";
import { recentlyDone, comingUp, hasDetail, progress, SHOWN } from "@/lib/client-page";
import type { ClientDeliverable } from "@/lib/client-page";

const day = (n: number) => new Date(2026, 7, n);

function deliverable(over: Partial<ClientDeliverable> & { id: string }): ClientDeliverable {
  return {
    name: over.id,
    done: false,
    doneAt: null,
    dueAt: null,
    order: 0,
    steps: [],
    ...over,
  };
}

function step(id: string, done: boolean, order: number) {
  return { id, name: id, done, order };
}

describe("recentlyDone", () => {
  it("prefers the steps inside a deliverable", () => {
    // "Exported the type scale" tells a client more about momentum than
    // "Design system" does.
    const list = [
      deliverable({
        id: "design",
        name: "Design system",
        done: true,
        doneAt: day(4),
        steps: [step("Type scale", true, 0), step("Colour", true, 1)],
      }),
    ];
    expect(recentlyDone(list).map((l) => l.text)).toEqual(["Colour", "Type scale"]);
    expect(recentlyDone(list)[0].under).toBe("Design system");
  });

  it("falls back to the deliverable when it was never broken down", () => {
    // A freelancer who never uses steps still gets a page that fills in.
    const list = [deliverable({ id: "Logo", done: true, doneAt: day(4) })];
    expect(recentlyDone(list).map((l) => l.text)).toEqual(["Logo"]);
  });

  it("puts the newest first", () => {
    const list = [
      deliverable({ id: "Old", done: true, doneAt: day(1) }),
      deliverable({ id: "New", done: true, doneAt: day(9) }),
    ];
    expect(recentlyDone(list).map((l) => l.text)).toEqual(["New", "Old"]);
  });

  it("shows three and no more", () => {
    // A client wants to know things are moving. A complete audit trail
    // answers a different question nobody asked.
    const list = Array.from({ length: 8 }, (_, i) =>
      deliverable({ id: `D${i}`, done: true, doneAt: day(i + 1) })
    );
    expect(recentlyDone(list)).toHaveLength(SHOWN);
  });

  it("says nothing when nothing is finished", () => {
    expect(recentlyDone([deliverable({ id: "Not started" })])).toEqual([]);
  });

  it("ignores unfinished steps", () => {
    const list = [
      deliverable({
        id: "Build",
        done: false,
        steps: [step("Setup", true, 0), step("Deploy", false, 1)],
      }),
    ];
    expect(recentlyDone(list).map((l) => l.text)).toEqual(["Setup"]);
  });
});

describe("comingUp", () => {
  it("lists the unfinished steps of work already under way", () => {
    const list = [
      deliverable({
        id: "Build",
        steps: [step("Setup", true, 0), step("Deploy", false, 1)],
      }),
      deliverable({ id: "Handover" }),
    ];
    expect(comingUp(list).map((l) => l.text)).toEqual(["Deploy", "Handover"]);
  });

  it("skips anything already finished", () => {
    const list = [deliverable({ id: "Done", done: true }), deliverable({ id: "Next" })];
    expect(comingUp(list).map((l) => l.text)).toEqual(["Next"]);
  });

  it("keeps the planned order rather than sorting by date", () => {
    // Plenty of projects have no dates at all, so the sequence the work was
    // planned in is the more reliable answer.
    const list = [
      deliverable({ id: "First", dueAt: day(20) }),
      deliverable({ id: "Second", dueAt: day(2) }),
    ];
    expect(comingUp(list).map((l) => l.text)).toEqual(["First", "Second"]);
  });

  it("shows three and no more", () => {
    const list = Array.from({ length: 9 }, (_, i) => deliverable({ id: `D${i}` }));
    expect(comingUp(list)).toHaveLength(SHOWN);
  });

  it("has nothing to say on a finished project", () => {
    expect(comingUp([deliverable({ id: "Done", done: true })])).toEqual([]);
  });
});

describe("hasDetail", () => {
  it("is true only when there is a list worth opening", () => {
    expect(hasDetail(deliverable({ id: "a" }))).toBe(false);
    expect(hasDetail(deliverable({ id: "a", steps: [step("s", false, 0)] }))).toBe(true);
  });
});

describe("progress", () => {
  it("counts deliverables", () => {
    const list = [
      deliverable({ id: "a", done: true }),
      deliverable({ id: "b" }),
      deliverable({ id: "c" }),
      deliverable({ id: "d" }),
    ];
    expect(progress(list)).toEqual({ done: 1, total: 4, percent: 25 });
  });

  it("survives an empty project", () => {
    expect(progress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});
