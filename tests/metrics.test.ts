import { describe, it, expect } from "vitest";
import {
  funnel,
  rate,
  activeUsers,
  retention,
  perDay,
  byKind,
  MIN_SAMPLE,
  type EventRow,
} from "@/lib/metrics";

const NOW = new Date("2026-08-14T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * 24 * 3600_000);

function event(
  kind: string,
  over: Partial<EventRow> = {}
): EventRow {
  return { kind, userId: "u1", subjectId: "b1", createdAt: ago(1), ...over };
}

describe("funnel", () => {
  it("counts distinct quotes, not events", () => {
    // Publishing the same quote three times is one quote. Counting rows would
    // show more published than generated, which is the shape of the bug that
    // makes a funnel meaningless.
    const events = [
      event("quote_generated", { subjectId: "b1" }),
      event("quote_published", { subjectId: "b1" }),
      event("quote_published", { subjectId: "b1" }),
      event("quote_published", { subjectId: "b1" }),
    ];
    expect(funnel(events)).toMatchObject({ generated: 1, published: 1 });
  });

  it("counts each step separately", () => {
    const events = [
      event("quote_generated", { subjectId: "b1" }),
      event("quote_generated", { subjectId: "b2" }),
      event("quote_published", { subjectId: "b1" }),
      event("quote_accepted", { subjectId: "b1" }),
      event("project_tracked", { subjectId: "p1" }),
      event("invoice_created", { subjectId: "i1" }),
    ];
    expect(funnel(events)).toEqual({
      generated: 2,
      published: 1,
      accepted: 1,
      tracked: 1,
      invoiced: 1,
    });
  });

  it("ignores events with nothing to count", () => {
    // An event with no subject cannot be deduplicated, so counting it would
    // reintroduce exactly the double counting this avoids.
    expect(funnel([event("quote_generated", { subjectId: null })]).generated).toBe(0);
  });

  it("is all zeros on an empty database", () => {
    expect(funnel([])).toEqual({
      generated: 0,
      published: 0,
      accepted: 0,
      tracked: 0,
      invoiced: 0,
    });
  });
});

describe("rate", () => {
  it("refuses to make a percentage out of nothing", () => {
    // "100% of quotes accepted" off two quotes changes how somebody prices
    // their work, and it means nothing.
    expect(rate(2, 2)).toBeNull();
    expect(rate(1, MIN_SAMPLE - 1)).toBeNull();
  });

  it("gives a percentage once there is enough", () => {
    expect(rate(5, 10)).toBe(50);
  });

  it("rounds rather than showing a float", () => {
    expect(rate(1, 3, 1)).toBe(33);
  });

  it("survives a zero denominator", () => {
    expect(rate(0, 0)).toBeNull();
  });
});

describe("activeUsers", () => {
  it("counts people, not events", () => {
    const events = [
      event("quote_generated", { userId: "u1" }),
      event("quote_generated", { userId: "u1" }),
      event("quote_generated", { userId: "u2" }),
    ];
    expect(activeUsers(events)).toBe(2);
  });

  it("ignores events with nobody attached", () => {
    expect(activeUsers([event("quote_accepted", { userId: null })])).toBe(0);
  });
});

describe("retention", () => {
  it("does not count signing in as using the product", () => {
    // Somebody who signed up and never did anything is not activated, and
    // counting them is how a team convinces itself onboarding works.
    const events = [event("signed_up", { userId: "u1", createdAt: ago(5) })];
    expect(retention(events, ago(30))).toEqual({ joined: 1, activated: 0, returned: 0 });
  });

  it("counts one real action as activated", () => {
    const events = [
      event("signed_up", { userId: "u1", createdAt: ago(5) }),
      event("quote_generated", { userId: "u1", createdAt: ago(4) }),
    ];
    expect(retention(events, ago(30))).toEqual({ joined: 1, activated: 1, returned: 0 });
  });

  it("counts a second quote as coming back", () => {
    const events = [
      event("signed_up", { userId: "u1", createdAt: ago(5) }),
      event("quote_generated", { userId: "u1", createdAt: ago(4) }),
      event("quote_generated", { userId: "u1", createdAt: ago(2) }),
    ];
    expect(retention(events, ago(30))).toEqual({ joined: 1, activated: 1, returned: 1 });
  });

  it("ignores people who signed up before the window", () => {
    const events = [
      event("signed_up", { userId: "old", createdAt: ago(90) }),
      event("quote_generated", { userId: "old", createdAt: ago(1) }),
    ];
    expect(retention(events, ago(30)).joined).toBe(0);
  });
});

describe("perDay", () => {
  it("includes the quiet days", () => {
    // Skipping empty days draws a straight line between two peaks, which reads
    // as steady use and is the opposite of the truth.
    const events = [event("quote_generated", { createdAt: ago(0) })];
    const days = perDay(events, "quote_generated", 5, NOW);
    expect(days).toHaveLength(5);
    expect(days.filter((d) => d.count === 0)).toHaveLength(4);
  });

  it("ends on today", () => {
    const days = perDay([], "quote_generated", 3, NOW);
    expect(days[days.length - 1].day).toBe("2026-08-14");
  });

  it("counts only the kind asked for", () => {
    const events = [
      event("quote_generated", { createdAt: ago(0) }),
      event("invoice_created", { createdAt: ago(0) }),
    ];
    expect(perDay(events, "quote_generated", 2, NOW).at(-1)?.count).toBe(1);
  });
});

describe("byKind", () => {
  it("puts the busiest first", () => {
    const events = [
      event("quote_generated"),
      event("quote_generated"),
      event("invoice_created"),
    ];
    expect(byKind(events)[0]).toEqual({ kind: "quote_generated", count: 2 });
  });

  it("has nothing to say about nothing", () => {
    expect(byKind([])).toEqual([]);
  });
});
