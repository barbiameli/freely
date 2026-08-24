import { describe, it, expect } from "vitest";
import { ROADMAP, outstanding, ofKind, remaining, type RoadmapItem } from "@/lib/roadmap";

/**
 * A hand-maintained list, so what is checked is that it stays usable.
 *
 * Nothing here asserts the contents. The point of the list is that it changes,
 * and a test that froze it would be a test somebody deletes the first time they
 * add a row. What is worth guarding is the shape: unique ids so an item can be
 * referred to, a reason on every item since the reason is the whole value, and
 * an order that does not put "later" above "next".
 */
describe("the roadmap stays usable", () => {
  it("has no duplicate ids", () => {
    const ids = ROADMAP.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // A title on its own gets remade differently in three weeks. The reason is
  // the part that survives being forgotten.
  it("gives every item a reason", () => {
    for (const item of ROADMAP) {
      expect(item.note.trim().length, item.id).toBeGreaterThan(20);
    }
  });

  it("keeps titles short enough to scan", () => {
    for (const item of ROADMAP) {
      expect(item.title.length, item.id).toBeLessThan(60);
    }
  });
});

describe("outstanding", () => {
  const items: RoadmapItem[] = [
    { id: "a", kind: "feature", state: "later", title: "A", note: "x".repeat(30) },
    { id: "b", kind: "bug", state: "done", title: "B", note: "x".repeat(30) },
    { id: "c", kind: "feature", state: "next", title: "C", note: "x".repeat(30) },
  ];

  it("leaves out what is finished", () => {
    expect(outstanding(items).map((i) => i.id)).toEqual(["c", "a"]);
  });

  it("puts next above later", () => {
    expect(outstanding(items)[0].state).toBe("next");
  });

  // A total that grows every time something is fixed is a number nobody wants
  // to look at.
  it("counts only what is left", () => {
    expect(remaining(items)).toBe(2);
  });
});

describe("ofKind", () => {
  it("returns one kind whatever its state", () => {
    expect(ofKind("decision").every((item) => item.kind === "decision")).toBe(true);
  });

  it("has something to show in every tab", () => {
    expect(ofKind("bug").length).toBeGreaterThan(0);
    expect(ofKind("decision").length).toBeGreaterThan(0);
    expect(outstanding().length).toBeGreaterThan(0);
  });
});
