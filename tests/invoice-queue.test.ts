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
