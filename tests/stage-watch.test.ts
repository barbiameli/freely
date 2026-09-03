import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { addBusinessDays, businessDaysBetween } from "@/lib/business-days";
import { deliveredAt, needsAction, watchStages, type WatchedStage } from "@/lib/stage-watch";
import { dict } from "@/lib/i18n";

/** A Monday, so the weekend arithmetic is easy to reason about. */
const MON = "2026-08-31T09:00:00Z";
const windows = { acceptanceDays: 10, feedbackDays: 3 };

function stage(over: Partial<WatchedStage> = {}): WatchedStage {
  return {
    id: "m1",
    projectId: "p1",
    projectTitle: "Ergo internal tool",
    client: "Beyond Data",
    name: "Review and interviews",
    amount: 300,
    currency: "USD",
    invoicedAt: null,
    deliverables: [
      { done: true, doneAt: MON },
      { done: true, doneAt: MON },
    ],
    ...over,
  };
}

/**
 * The clauses, actually running.
 *
 * A quote can say that delivered work with no response after ten business days
 * counts as accepted and is invoiced. Nothing used to watch for that, so the
 * sentence sat on the document while somebody waited inside a live project,
 * unpaid, with no mechanism to charge for it or release their time.
 */
describe("counting in business days", () => {
  it("skips the weekend", () => {
    // Monday to the following Monday is five working days, not seven.
    expect(businessDaysBetween(MON, "2026-09-07T09:00:00Z")).toBe(5);
  });

  it("does not count the day something was delivered", () => {
    // Work delivered on Monday has had nought business days by Monday evening.
    expect(businessDaysBetween(MON, "2026-08-31T23:00:00Z")).toBe(0);
    expect(businessDaysBetween(MON, "2026-09-01T08:00:00Z")).toBe(1);
  });

  it("ignores the hour something was ticked off", () => {
    // Otherwise the answer depends on whether somebody worked late.
    const early = businessDaysBetween("2026-08-31T01:00:00Z", "2026-09-03T23:00:00Z");
    const late = businessDaysBetween("2026-08-31T23:00:00Z", "2026-09-03T01:00:00Z");
    expect(early).toBe(late);
  });

  it("never goes backwards", () => {
    expect(businessDaysBetween("2026-09-07T09:00:00Z", MON)).toBe(0);
  });

  it("can say when something falls due", () => {
    // Three business days from a Monday is Thursday.
    expect(addBusinessDays(MON, 3).toISOString().slice(0, 10)).toBe("2026-09-03");
    // And five is the next Monday, not Saturday.
    expect(addBusinessDays(MON, 5).toISOString().slice(0, 10)).toBe("2026-09-07");
  });
});

describe("when a stage counts as delivered", () => {
  it("is the last piece of it to land", () => {
    const s = stage({
      deliverables: [
        { done: true, doneAt: MON },
        { done: true, doneAt: "2026-09-02T09:00:00Z" },
      ],
    });
    expect(deliveredAt(s)).toBe("2026-09-02T09:00:00.000Z");
  });

  it("is nothing while any of it is outstanding", () => {
    // Starting a clock on a half-finished stage would eventually invoice for
    // work nobody has sent.
    expect(deliveredAt(stage({ deliverables: [{ done: true, doneAt: MON }, { done: false, doneAt: null }] }))).toBeNull();
  });

  it("is nothing when the dates were never recorded", () => {
    // Real on older projects, and not something to guess at.
    expect(deliveredAt(stage({ deliverables: [{ done: true, doneAt: null }] }))).toBeNull();
  });

  it("is nothing for a stage with no deliverables at all", () => {
    expect(deliveredAt(stage({ deliverables: [] }))).toBeNull();
  });
});

describe("what each stage is waiting on", () => {
  it("says a stage is accepted once the window has passed", () => {
    const found = watchStages([stage()], windows, new Date("2026-09-15T09:00:00Z"));
    expect(found[0].kind).toBe("deemedAccepted");
    expect(found[0].businessDays).toBe(11);
  });

  it("flags feedback that is late without calling it accepted", () => {
    const found = watchStages([stage()], windows, new Date("2026-09-07T09:00:00Z"));
    expect(found[0].kind).toBe("feedbackOverdue");
  });

  it("says nothing about a stage still inside its window", () => {
    const found = watchStages([stage()], windows, new Date("2026-09-02T09:00:00Z"));
    expect(found[0].kind).toBe("waiting");
    expect(needsAction(found)).toEqual([]);
  });

  it("leaves a stage that has already been billed alone", () => {
    // Settled, whatever the client said or did not say.
    const billed = stage({ invoicedAt: "2026-09-01T09:00:00Z" });
    expect(watchStages([billed], windows, new Date("2026-09-30T09:00:00Z"))).toEqual([]);
  });

  it("respects the account's own windows", () => {
    const patient = watchStages([stage()], { acceptanceDays: 30, feedbackDays: 10 }, new Date("2026-09-15T09:00:00Z"));
    expect(patient[0].kind).toBe("feedbackOverdue");
  });

  it("puts the money first, then the schedule", () => {
    const accepted = stage({ id: "a", name: "Old stage" });
    const late = stage({ id: "b", name: "Newer stage", deliverables: [{ done: true, doneAt: "2026-09-08T09:00:00Z" }] });
    const found = needsAction(watchStages([late, accepted], windows, new Date("2026-09-15T09:00:00Z")));
    expect(found.map((f) => f.stage.name)).toEqual(["Old stage", "Newer stage"]);
  });
});

describe("what the app does with it", () => {
  const view = readFileSync("src/app/(app)/home/home-view.tsx", "utf8");
  const page = readFileSync("src/app/(app)/home/page.tsx", "utf8");

  it("never invoices anybody on its own", () => {
    // Invoicing automatically on a clause the client has possibly forgotten
    // agreeing to is a way to lose one rather than a way to get paid.
    const watch = readFileSync("src/lib/stage-watch.ts", "utf8");
    expect(watch).toContain("Nothing here acts on its own");
    expect(page).not.toContain("invoiceDb.create");
  });

  it("says it before the overdue invoices", () => {
    // Money not yet asked for is worse than money asked for and not arrived.
    expect(view.indexOf("needStageAccepted")).toBeLessThan(view.indexOf("needInvoiceLate"));
  });

  it("quotes the freelancer's own terms back at them", () => {
    // "By your own terms it counts as accepted" rather than "chase this",
    // because the clause is the thing that makes it true.
    expect(view).toContain("t.home.needStageAccepted");
    expect(dict("en").home.needStageAccepted).toContain("By your own terms");
  });

  it("uses the account's windows rather than a number written here", () => {
    expect(page).toContain("acceptanceDays: ruleWindows.acceptanceDays");
    expect(page).toContain("feedbackDays: ruleWindows.feedbackDays");
  });
});
