import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  boardProgress,
  changesFor,
  changesForMove,
  columnOf,
  columnSteps,
  reorder,
  type BoardStep,
} from "@/lib/board";

const NOW = new Date("2026-09-07T10:00:00Z");
const MONDAY = new Date("2026-09-01T09:00:00Z");

function step(over: Partial<BoardStep> = {}): BoardStep {
  return {
    id: "a",
    name: "Draft new screens",
    done: false,
    startedAt: null,
    order: 0,
    estimateHours: 0,
    deliverableId: "d1",
    ...over,
  };
}

describe("which column a task is in", () => {
  it("reads it off what the task already knows", () => {
    expect(columnOf(step())).toBe("TODO");
    expect(columnOf(step({ startedAt: MONDAY.toISOString() }))).toBe("DOING");
    expect(columnOf(step({ done: true }))).toBe("DONE");
  });

  it("lets done win over a leftover start", () => {
    // A task that was in Doing and got ticked is finished, not in progress.
    expect(columnOf(step({ done: true, startedAt: MONDAY.toISOString() }))).toBe("DONE");
  });
});

describe("what moving a card changes", () => {
  it("ticks it off on the way into Done", () => {
    expect(changesFor("DONE", NOW)).toEqual({ done: true, startedAt: null, doneAt: NOW });
  });

  it("unticks it on the way out", () => {
    // The whole point of dragging it back.
    expect(changesFor("DOING", NOW).done).toBe(false);
    expect(changesFor("TODO", NOW).done).toBe(false);
  });

  it("clears the start when it goes back to To do", () => {
    // A card in To do insisting it started on Tuesday is a card lying.
    expect(changesFor("TODO", NOW).startedAt).toBeNull();
  });

  it("keeps the original start when reordering inside Doing", () => {
    // Otherwise nudging a card up the column on Wednesday claims the work
    // began on Wednesday.
    expect(changesForMove("DOING", "DOING", MONDAY, NOW).startedAt).toBe(MONDAY);
  });

  it("stamps a new start when it first enters Doing", () => {
    expect(changesForMove("TODO", "DOING", null, NOW).startedAt).toBe(NOW);
  });
});

describe("ordering inside a column", () => {
  it("drops a card at the index asked for", () => {
    expect(reorder(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(reorder(["a", "b", "c"], "a", 2)).toEqual(["b", "c", "a"]);
  });

  it("survives an index past either end", () => {
    expect(reorder(["a", "b"], "a", 99)).toEqual(["b", "a"]);
    expect(reorder(["a", "b"], "b", -3)).toEqual(["b", "a"]);
  });

  it("returns the whole column, not one position", () => {
    // Writing a single order value leaves ties, and ties look like cards
    // swapping places at random after a reload.
    expect(reorder(["a", "b", "c"], "b", 2)).toHaveLength(3);
  });

  it("draws a column in order", () => {
    const steps = [
      step({ id: "second", order: 1 }),
      step({ id: "first", order: 0 }),
      step({ id: "done", done: true }),
    ];
    expect(columnSteps(steps, "TODO").map((s) => s.id)).toEqual(["first", "second"]);
    expect(columnSteps(steps, "DONE").map((s) => s.id)).toEqual(["done"]);
  });
});

describe("how far through", () => {
  it("weights by estimate rather than counting cards", () => {
    // Two ticked ten-minute tasks are not half of a project whose third task
    // is two days long.
    const steps = [
      step({ id: "a", done: true, estimateHours: 0.5 }),
      step({ id: "b", done: true, estimateHours: 0.5 }),
      step({ id: "c", estimateHours: 15 }),
    ];
    expect(boardProgress(steps)).toEqual({ done: 1, total: 16 });
  });

  it("counts cards when nothing is estimated", () => {
    const steps = [step({ id: "a", done: true }), step({ id: "b" })];
    expect(boardProgress(steps)).toEqual({ done: 1, total: 2 });
  });

  it("does not divide by zero on an empty board", () => {
    expect(boardProgress([])).toEqual({ done: 0, total: 0 });
  });
});


describe("the board on the page", () => {
  const board = readFileSync("src/components/track/board.tsx", "utf8");
  const action = readFileSync("src/actions/board.ts", "utf8");

  it("can be used without a drag", () => {
    // Touch does not fire HTML5 drag events, so a drag-only board is
    // unusable on a phone, which is where half of this app gets opened.
    expect(board).toContain("t.track.boardMoveTo");
    expect(board).toContain("md:hidden");
  });

  it("stacks rather than scrolling sideways on a phone", () => {
    // A board that scrolls horizontally hides two thirds of itself.
    expect(board).toContain("grid-cols-1 md:grid-cols-3");
  });

  it("writes the whole column in one transaction", () => {
    // A move that ticks one task off and reorders four others, half applied,
    // is a board that disagrees with itself.
    expect(action).toContain("prisma.$transaction");
    expect(action).toContain("ordered.map");
  });

  it("checks the task belongs to the person moving it", () => {
    // A Step has no owner of its own and the id arrives from the browser.
    expect(action).toContain("teamScopeWhere(user)");
  });
});
