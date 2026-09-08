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
    expect(action).toContain("prisma.$transaction(async (tx)");
  });

  it("does not hand Prisma an array it will not run", () => {
    // The array form of $transaction requires every element to be a
    // PrismaPromise. These come through a cast wrapper, so the batch was
    // handed over as something Prisma refused, and the write that appeared
    // to succeed had done nothing.
    expect(action).not.toContain("as unknown as Parameters<typeof prisma.$transaction>[0]");
  });

  it("checks the task belongs to the person moving it", () => {
    // A Step has no owner of its own and the id arrives from the browser.
    expect(action).toContain("teamScopeWhere(user)");
  });
});

describe("a drag that actually starts", () => {
  const board = readFileSync("src/components/track/board.tsx", "utf8");
  const chart = readFileSync("src/components/track/timeline.tsx", "utf8");
  const action = readFileSync("src/actions/board.ts", "utf8");

  it("puts something on the dataTransfer", () => {
    // Without it the browser cancels the drag straight after dragstart, so
    // no dragover and no drop ever fire and the card simply does not move.
    // Firefox refuses outright; Chrome is inconsistent. The payload is
    // unused, the act of setting it is the point.
    expect(board).toContain('e.dataTransfer.setData("text/plain"');
    expect(chart).toContain('e.dataTransfer.setData("text/plain"');
  });

  it("says the drop is a move", () => {
    expect(board).toContain('e.dataTransfer.effectAllowed = "move"');
    expect(board).toContain('e.dataTransfer.dropEffect = "move"');
  });

  it("does not reach through a relation to find the tasks", () => {
    // stepDb is a cast around the generated client, and a where clause
    // reaching through a relation came back empty: the column being reordered
    // was empty, so the move wrote nothing and the planner placed nothing
    // while reporting that everything fitted.
    expect(action).not.toContain("where: { deliverable: { projectId: project.id } }");
    expect(action).toContain("include: { steps: { orderBy: { order: \"asc\" } } }");
  });

  it("refuses to call an empty plan a plan", () => {
    expect(action).toContain("if (plan.length === 0)");
    expect(action).toContain("There are no tasks to place yet");
  });
});

describe("writing on the board", () => {
  const board = readFileSync("src/components/track/board.tsx", "utf8");
  const action = readFileSync("src/actions/board.ts", "utf8");

  it("can add, rename, re-estimate and delete", () => {
    // It could be dragged and timed and not typed into, which makes it a
    // viewer. The list arrives generated, so the first version is never quite
    // right, and the only repair rewrote every step on a deliverable.
    for (const fn of ["addTaskAction", "editTaskAction", "deleteTaskAction"]) {
      expect(action).toContain(`export async function ${fn}`);
      expect(board).toContain(fn);
    }
  });

  it("holds a typed task to the same length as a generated one", () => {
    // A task somebody writes is not exempt from being readable on a board.
    expect(action).toContain("taskLabel(sanitizeText(name))");
  });

  it("only offers to add in To do", () => {
    // A task you are about to write has not been started and is certainly
    // not finished.
    expect(board).toContain('column === "TODO" && deliverables.length > 0');
  });

  it("edits in place rather than in a dialog", () => {
    // A modal to rename four words is a bigger interruption than the thing
    // it edits.
    expect(board).toContain("editing?.id === card.id");
    expect(board).not.toContain("<Modal");
  });

  it("keeps the add form open after adding one", () => {
    // Somebody adding one task is usually adding three.
    expect(board).toContain('setAdding({ deliverableId: adding.deliverableId, name: "" })');
  });
});

describe("the clock on a card", () => {
  const board = readFileSync("src/components/track/board.tsx", "utf8");
  const time = readFileSync("src/actions/time.ts", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("records which task, not just which project", () => {
    const entry = schema.slice(schema.indexOf("model TimeEntry"));
    expect(entry.slice(0, 900)).toContain("stepId String?");
    expect(time).toContain("stepId: step.id");
  });

  it("does not offer a clock on finished work", () => {
    expect(board).toContain("canTrack && !card.done");
  });

  it("stays hidden until the tracker has been set up", () => {
    expect(board).toContain("if (!canTrack) return;");
  });
});

describe("a plan that can change", () => {
  const detail = readFileSync("src/app/(app)/track/[projectId]/project-detail.tsx", "utf8");

  it("is not a one-time gate", () => {
    // plannedAt used to hide the panel forever, so once a project was planned
    // there was no way to change the dates, the hours, the working days or
    // the stars. Those are exactly the things that change.
    expect(detail).toContain("(!project.plannedAt || replanning)");
    expect(detail).toContain("t.track.replan");
  });
});
