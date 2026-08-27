import { describe, it, expect } from "vitest";
import {
  billable,
  invoiceQueue,
  readyCount,
  splitPrice,
  type QueueProject,
} from "@/lib/invoice-queue";

function project(over: Partial<QueueProject> = {}): QueueProject {
  return {
    id: "p1",
    title: "Brand refresh",
    client: "Aurora",
    price: 3000,
    hours: 30,
    currency: "GBP",
    billing: "ON_COMPLETION",
    status: "ACTIVE",
    invoiceCount: 0,
    deliverables: [],
    ...over,
  };
}

function deliverable(id: string, done: boolean, hours: number[], invoicedAt: Date | null = null) {
  return { id, name: `Deliverable ${id}`, done, invoicedAt, steps: hours.map((h) => ({ estimateHours: h })) };
}

describe("splitPrice", () => {
  it("splits by estimated hours", () => {
    const p = project({
      price: 3000,
      deliverables: [deliverable("a", false, [10]), deliverable("b", false, [20])],
    });
    const shares = splitPrice(p);
    expect(shares.get("a")).toBe(1000);
    expect(shares.get("b")).toBe(2000);
  });

  it("splits equally when no deliverable has an estimate", () => {
    const p = project({
      price: 900,
      deliverables: [deliverable("a", false, []), deliverable("b", false, []), deliverable("c", false, [])],
    });
    const shares = splitPrice(p);
    expect([shares.get("a"), shares.get("b"), shares.get("c")]).toEqual([300, 300, 300]);
  });

  it("always sums to exactly the project price, including when it does not divide", () => {
    const p = project({
      price: 100,
      deliverables: [deliverable("a", false, []), deliverable("b", false, []), deliverable("c", false, [])],
    });
    const shares = splitPrice(p);
    // Array.from rather than a spread: the Map iterator needs a newer compile
    // target than this project uses.
    const total = Array.from(shares.values()).reduce((s, v) => s + v, 0);
    expect(total).toBe(100);
    // The remainder lands on the last share rather than vanishing.
    expect(shares.get("c")).toBeCloseTo(33.34, 2);
  });
});

describe("billable, per milestone", () => {
  const per = { billing: "PER_MILESTONE" as const };

  it("bills each finished deliverable that has not been billed", () => {
    const p = project({
      ...per,
      price: 3000,
      deliverables: [deliverable("a", true, [10]), deliverable("b", false, [20])],
    });
    const entry = billable(p);
    expect(entry.lines).toHaveLength(1);
    expect(entry.lines[0].title).toBe("Deliverable a");
    expect(entry.total).toBe(1000);
  });

  it("skips a milestone that has already been billed", () => {
    const p = project({
      ...per,
      price: 3000,
      deliverables: [deliverable("a", true, [10], new Date()), deliverable("b", true, [20])],
    });
    const entry = billable(p);
    expect(entry.lines).toHaveLength(1);
    expect(entry.total).toBe(2000);
  });

  it("says nothing is done rather than showing an empty invoice", () => {
    const p = project({ ...per, deliverables: [deliverable("a", false, [10])] });
    expect(billable(p).notReady).toBe("nothing-done");
  });

  it("is finished once every milestone is billed", () => {
    const p = project({
      ...per,
      deliverables: [deliverable("a", true, [10], new Date()), deliverable("b", true, [20], new Date())],
    });
    expect(billable(p).notReady).toBe("already-invoiced");
  });
});

describe("billable, on completion", () => {
  it("waits until every deliverable is done", () => {
    const p = project({ deliverables: [deliverable("a", true, [10]), deliverable("b", false, [20])] });
    const entry = billable(p);
    expect(entry.lines).toHaveLength(0);
    expect(entry.notReady).toBe("in-progress");
  });

  it("bills the whole project once complete", () => {
    const p = project({ price: 3000, hours: 30, deliverables: [deliverable("a", true, [10]), deliverable("b", true, [20])] });
    const entry = billable(p);
    expect(entry.lines).toEqual([
      { deliverableId: null, title: "Brand refresh", hours: 30, amount: 3000 },
    ]);
  });

  it("falls back to the project status when there are no deliverables", () => {
    expect(billable(project({ status: "DONE" })).lines).toHaveLength(1);
    expect(billable(project({ status: "ACTIVE" })).notReady).toBe("nothing-done");
  });

  it("does not offer a second invoice for the same project", () => {
    const p = project({
      invoiceCount: 1,
      deliverables: [deliverable("a", true, [10])],
    });
    expect(billable(p).notReady).toBe("already-invoiced");
  });
});

describe("invoiceQueue", () => {
  it("puts what is ready first, largest first, and keeps the rest visible", () => {
    const ready = project({
      id: "ready",
      price: 1000,
      deliverables: [deliverable("a", true, [10])],
    });
    const bigger = project({
      id: "bigger",
      price: 5000,
      deliverables: [deliverable("a", true, [10])],
    });
    const waiting = project({
      id: "waiting",
      deliverables: [deliverable("a", false, [10])],
    });

    const queue = invoiceQueue([waiting, ready, bigger]);
    expect(queue.map((e) => e.project.id)).toEqual(["bigger", "ready", "waiting"]);
    expect(readyCount(queue)).toBe(2);
  });

  it("drops projects that are fully invoiced", () => {
    const done = project({ id: "done", invoiceCount: 1, deliverables: [deliverable("a", true, [1])] });
    expect(invoiceQueue([done])).toHaveLength(0);
  });
});

describe("billing a project that has real milestones", () => {
  /**
   * A milestone groups deliverables. The old behaviour billed each deliverable
   * as if it were a milestone, so a six-deliverable project agreed as three
   * milestones invoiced six times at a sixth each: wrong amount, wrong day.
   */
  const milestones = [
    { id: "m1", name: "Discovery", order: 0, amount: 1200, invoicedAt: null },
    { id: "m2", name: "Design", order: 1, amount: 1800, invoicedAt: null },
  ];

  function inMilestone(id: string, milestoneId: string, done: boolean, hours: number[]) {
    return {
      id,
      name: `Deliverable ${id}`,
      done,
      invoicedAt: null,
      milestoneId,
      steps: hours.map((h) => ({ estimateHours: h })),
    };
  }

  it("bills a whole milestone at the amount agreed, not per deliverable", () => {
    const p = project({
      billing: "PER_MILESTONE",
      price: 3000,
      milestones,
      deliverables: [
        inMilestone("a", "m1", true, [10]),
        inMilestone("b", "m1", true, [5]),
        inMilestone("c", "m2", false, [15]),
      ],
    });
    const entry = billable(p);
    expect(entry.lines).toHaveLength(1);
    expect(entry.lines[0].title).toBe("Discovery");
    expect(entry.lines[0].amount).toBe(1200);
    // Both of its deliverables, summed.
    expect(entry.lines[0].hours).toBe(15);
    expect(entry.total).toBe(1200);
  });

  it("offers nothing while a milestone is only half finished", () => {
    // Half a milestone is not a fraction of an invoice. The client agreed to
    // pay when the milestone completes.
    const p = project({
      billing: "PER_MILESTONE",
      price: 3000,
      milestones,
      deliverables: [
        inMilestone("a", "m1", true, [10]),
        inMilestone("b", "m1", false, [5]),
      ],
    });
    const entry = billable(p);
    expect(entry.lines).toEqual([]);
    expect(entry.notReady).toBe("nothing-done");
  });

  it("bills both once the whole project is done", () => {
    const p = project({
      billing: "PER_MILESTONE",
      price: 3000,
      milestones,
      deliverables: [
        inMilestone("a", "m1", true, [10]),
        inMilestone("b", "m2", true, [20]),
      ],
    });
    const entry = billable(p);
    expect(entry.lines.map((l) => l.title)).toEqual(["Discovery", "Design"]);
    expect(entry.total).toBe(3000);
  });

  it("does not offer a milestone already invoiced", () => {
    const p = project({
      billing: "PER_MILESTONE",
      price: 3000,
      milestones: [{ ...milestones[0], invoicedAt: new Date() }, milestones[1]],
      deliverables: [
        inMilestone("a", "m1", true, [10]),
        inMilestone("b", "m2", true, [20]),
      ],
    });
    expect(billable(p).lines.map((l) => l.title)).toEqual(["Design"]);
  });

  it("says everything is billed once all milestones are", () => {
    const p = project({
      billing: "PER_MILESTONE",
      price: 3000,
      milestones: milestones.map((m) => ({ ...m, invoicedAt: new Date() })),
      deliverables: [inMilestone("a", "m1", true, [10])],
    });
    expect(billable(p).notReady).toBe("already-invoiced");
  });

  it("falls back to the old per-deliverable split on a project quoted before milestones existed", () => {
    // Those projects have no milestone rows. Refusing to bill them at all
    // would be worse than billing them the way they were always billed.
    const p = project({
      billing: "PER_MILESTONE",
      price: 3000,
      deliverables: [deliverable("a", true, [10]), deliverable("b", false, [20])],
    });
    const entry = billable(p);
    expect(entry.lines).toHaveLength(1);
    expect(entry.lines[0].deliverableId).toBe("a");
  });
});

describe("splitting money in a currency that has no cents", () => {
  const deliverables = [
    { id: "a", title: "One", status: "DONE", steps: [] },
    { id: "b", title: "Two", status: "DONE", steps: [] },
    { id: "c", title: "Three", status: "DONE", steps: [] },
  ];

  function project(currency: string) {
    return {
      id: "p",
      title: "T",
      client: "C",
      price: 4000,
      hours: 40,
      currency,
      billing: "ON_COMPLETION" as const,
      status: "ACTIVE",
      deliverables,
      invoiceCount: 0,
    };
  }

  /**
   * The split used to round to two decimals whatever the currency. A yen
   * project produced shares of 1333.33, which the invoice printed as ¥1,333
   * because yen has no minor unit, and three of those do not add up to the
   * total printed underneath them.
   */
  it("gives yen whole numbers that add up", () => {
    const shares = Array.from(splitPrice(project("JPY") as never).values());
    expect(shares.every((n) => Number.isInteger(n))).toBe(true);
    expect(shares.reduce((sum, n) => sum + n, 0)).toBe(4000);
  });

  it("still gives pounds their pennies", () => {
    const shares = Array.from(splitPrice(project("GBP") as never).values());
    expect(shares).toEqual([1333.33, 1333.33, 1333.34]);
    expect(shares.reduce((sum, n) => sum + n, 0)).toBe(4000);
  });

  it("puts the remainder on the last line rather than losing it", () => {
    const shares = Array.from(
      splitPrice({ ...project("JPY"), price: 1000 } as never).values()
    );
    expect(shares.reduce((sum, n) => sum + n, 0)).toBe(1000);
  });
});
