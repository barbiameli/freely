import { describe, it, expect } from "vitest";
import {
  reconcileMilestones,
  balanceAmounts,
  milestoneProgress,
  isMilestoneDone,
  billableMilestones,
  type GeneratedMilestone,
} from "@/lib/milestones";

function m(name: string, deliverableIndexes: number[], amount = 0): GeneratedMilestone {
  return { name, deliverableIndexes, amount };
}

describe("reconcileMilestones", () => {
  it("keeps a clean split as it is", () => {
    const out = reconcileMilestones(
      [m("Discovery", [0, 1], 1000), m("Design", [2, 3], 1000)],
      4,
      2000
    );
    expect(out.map((x) => x.deliverableIndexes)).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(out.map((x) => x.amount)).toEqual([1000, 1000]);
  });

  it("bills a deliverable once when the model puts it in two milestones", () => {
    // Silent double billing otherwise: the client pays twice for one thing.
    const out = reconcileMilestones([m("A", [0, 1]), m("B", [1, 2])], 3, 900);
    expect(out[0].deliverableIndexes).toEqual([0, 1]);
    expect(out[1].deliverableIndexes).toEqual([2]);
  });

  it("picks up a deliverable the model left out of every milestone", () => {
    // Otherwise that work is never billable at all.
    const out = reconcileMilestones([m("A", [0]), m("B", [1])], 4, 1000);
    expect(out[1].deliverableIndexes).toEqual([1, 2, 3]);
  });

  it("ignores indexes that point at nothing", () => {
    const out = reconcileMilestones([m("A", [0, 9, -1])], 2, 500);
    expect(out[0].deliverableIndexes).toEqual([0, 1]);
  });

  it("drops a milestone covering no work", () => {
    const out = reconcileMilestones([m("A", [0, 1]), m("Empty", [])], 2, 800);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("A");
  });

  it("comes back empty when there is nothing to split", () => {
    expect(reconcileMilestones([], 3, 100)).toEqual([]);
    expect(reconcileMilestones([m("A", [0])], 0, 100)).toEqual([]);
  });
});

describe("balanceAmounts", () => {
  it("always sums to exactly the price", () => {
    // £100 across three at 33.33 loses a penny, and a client notices a total
    // that does not match the quote they agreed to.
    const out = balanceAmounts([m("A", [0]), m("B", [1]), m("C", [2])], 100);
    expect(out.reduce((sum, x) => sum + x.amount, 0)).toBe(100);
  });

  it("keeps the proportions the model gave", () => {
    const out = balanceAmounts([m("A", [0], 750), m("B", [1], 250)], 2000);
    expect(out.map((x) => x.amount)).toEqual([1500, 500]);
  });

  it("splits by how much work each covers when no amounts were given", () => {
    const out = balanceAmounts([m("A", [0, 1, 2]), m("B", [3])], 4000);
    expect(out.map((x) => x.amount)).toEqual([3000, 1000]);
  });

  it("handles an awkward total without losing anything", () => {
    const out = balanceAmounts([m("A", [0]), m("B", [1]), m("C", [2])], 2837.55);
    expect(out.reduce((sum, x) => sum + x.amount, 0)).toBeCloseTo(2837.55, 2);
  });
});

const MILESTONES = [
  { id: "m1", name: "Discovery", order: 0, amount: 1000 },
  { id: "m2", name: "Design", order: 1, amount: 1000 },
  { id: "m3", name: "Build", order: 2, amount: 1000 },
];

describe("isMilestoneDone", () => {
  it("needs every deliverable in it finished", () => {
    const deliverables = [
      { id: "d1", milestoneId: "m1", done: true },
      { id: "d2", milestoneId: "m1", done: false },
    ];
    expect(isMilestoneDone("m1", deliverables)).toBe(false);
  });

  it("is done when they all are", () => {
    const deliverables = [
      { id: "d1", milestoneId: "m1", done: true },
      { id: "d2", milestoneId: "m1", done: true },
    ];
    expect(isMilestoneDone("m1", deliverables)).toBe(true);
  });

  it("is not done when it contains nothing", () => {
    // An empty milestone cannot be finished, and treating it as finished would
    // let it be invoiced for work that was never described.
    expect(isMilestoneDone("m1", [])).toBe(false);
  });
});

describe("milestoneProgress", () => {
  it("counts milestones, not deliverables", () => {
    // The old behaviour: six deliverables read "Milestone 4 of 6" on a project
    // agreed as three milestones.
    const deliverables = [
      { id: "d1", milestoneId: "m1", done: true },
      { id: "d2", milestoneId: "m1", done: true },
      { id: "d3", milestoneId: "m2", done: true },
      { id: "d4", milestoneId: "m2", done: false },
      { id: "d5", milestoneId: "m3", done: false },
      { id: "d6", milestoneId: "m3", done: false },
    ];
    expect(milestoneProgress(MILESTONES, deliverables)).toEqual({ current: 2, total: 3 });
  });

  it("reads 3 of 3 at the end rather than 4 of 3", () => {
    const deliverables = MILESTONES.map((ms, i) => ({
      id: `d${i}`,
      milestoneId: ms.id,
      done: true,
    }));
    expect(milestoneProgress(MILESTONES, deliverables)).toEqual({ current: 3, total: 3 });
  });

  it("has nothing to say about a project with no milestones", () => {
    expect(milestoneProgress([], [{ id: "d1", done: false }])).toEqual({ current: 0, total: 0 });
  });
});

describe("billableMilestones", () => {
  it("offers a finished milestone that has not been billed", () => {
    const deliverables = [
      { id: "d1", milestoneId: "m1", done: true },
      { id: "d2", milestoneId: "m2", done: false },
    ];
    expect(billableMilestones(MILESTONES, deliverables).map((x) => x.id)).toEqual(["m1"]);
  });

  it("does not offer one already billed", () => {
    const billed = [{ ...MILESTONES[0], invoicedAt: new Date() }, ...MILESTONES.slice(1)];
    const deliverables = [{ id: "d1", milestoneId: "m1", done: true }];
    expect(billableMilestones(billed, deliverables)).toEqual([]);
  });

  it("returns them in order", () => {
    const deliverables = MILESTONES.map((ms, i) => ({
      id: `d${i}`,
      milestoneId: ms.id,
      done: true,
    }));
    const shuffled = [MILESTONES[2], MILESTONES[0], MILESTONES[1]];
    expect(billableMilestones(shuffled, deliverables).map((x) => x.id)).toEqual([
      "m1",
      "m2",
      "m3",
    ]);
  });
});

describe("the gate survives reconciliation", () => {
  /**
   * A milestone is a dependency boundary, not a bag of deliverables. What
   * makes it one is the thing that has to be agreed before the next chunk can
   * start, and that has to reach the quote intact: dropping it while fixing
   * the arithmetic would leave a split whose reason had been erased.
   */
  it("keeps the gate when the split is already clean", () => {
    const out = reconcileMilestones(
      [
        { name: "Discovery", deliverableIndexes: [0, 1], gate: "Direction agreed", amount: 1000 },
        { name: "Design", deliverableIndexes: [2], amount: 1000 },
      ],
      3,
      2000
    );
    expect(out[0].gate).toBe("Direction agreed");
    expect(out[1].gate).toBeUndefined();
  });

  it("keeps it while dropping a duplicated deliverable", () => {
    const out = reconcileMilestones(
      [
        { name: "A", deliverableIndexes: [0, 1], gate: "Stakeholders sign off", amount: 500 },
        { name: "B", deliverableIndexes: [1, 2], gate: "Content approved", amount: 500 },
      ],
      3,
      1000
    );
    expect(out.map((m) => m.gate)).toEqual(["Stakeholders sign off", "Content approved"]);
  });

  it("keeps it while absorbing a deliverable the model forgot", () => {
    const out = reconcileMilestones(
      [{ name: "Only one", deliverableIndexes: [0], gate: "Access confirmed", amount: 800 }],
      3,
      800
    );
    expect(out[0].gate).toBe("Access confirmed");
    expect(out[0].deliverableIndexes).toEqual([0, 1, 2]);
  });

  it("keeps it through rebalancing the amounts", () => {
    const out = balanceAmounts(
      [
        { name: "A", deliverableIndexes: [0], gate: "Kick-off held", amount: 0 },
        { name: "B", deliverableIndexes: [1], amount: 0 },
      ],
      100
    );
    expect(out[0].gate).toBe("Kick-off held");
  });
});
