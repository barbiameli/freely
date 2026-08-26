import { describe, it, expect } from "vitest";
import {
  formatCalendarDay,
  formatCalendarLongDay,
  isPastDue,
  daysUntilDue,
} from "@/lib/schedule";

/**
 * A due date is a day, not a moment.
 *
 * `<input type="date">` produces "2026-08-26", with no time and no place in
 * it. `new Date("2026-08-26")` reads that as midnight UTC, which is a real
 * instant, and an instant drifts: in New York it is eight in the evening on
 * the 25th.
 *
 * So an invoice due on the 26th showed 25/08 in the list, and the overdue
 * check fired at 8pm the night before it was due. The freelancer saw a red
 * invoice while their client still had a day to pay.
 *
 * Everything below fixes the zone rather than trusting the machine, which is
 * what makes these assertions mean anything: they pass in London and in New
 * York, and the old code did not.
 */
const DUE_26TH = new Date("2026-08-26"); // midnight UTC, as stored

describe("showing a due date", () => {
  it("shows the day that was typed", () => {
    expect(formatCalendarDay(DUE_26TH, "en")).toBe("26 Aug");
  });

  it("spells it out for a document somebody keeps", () => {
    expect(formatCalendarLongDay(DUE_26TH, "en")).toBe("26 August 2026");
  });

  it("uses the reader's language", () => {
    expect(formatCalendarLongDay(DUE_26TH, "es")).toMatch(/agosto/);
  });

  // The whole point. This is the assertion the old code failed.
  it("shows the same day whatever the machine's timezone is", () => {
    const original = process.env.TZ;
    const seen = new Set<string>();
    for (const zone of ["UTC", "America/New_York", "Asia/Tokyo", "Pacific/Auckland"]) {
      process.env.TZ = zone;
      seen.add(formatCalendarDay(new Date("2026-08-26"), "en"));
    }
    process.env.TZ = original;
    expect(Array.from(seen)).toEqual(["26 Aug"]);
  });
});

describe("isPastDue", () => {
  // Something due on the 26th is not late during the 26th.
  it("is not late on the morning it is due", () => {
    expect(isPastDue(DUE_26TH, new Date("2026-08-26T09:00:00Z"))).toBe(false);
  });

  it("is not late at the last minute of the day it is due", () => {
    expect(isPastDue(DUE_26TH, new Date("2026-08-26T23:59:59Z"))).toBe(false);
  });

  it("is late once the next day starts", () => {
    expect(isPastDue(DUE_26TH, new Date("2026-08-27T00:00:00Z"))).toBe(true);
  });

  // The old comparison turned this red at 8pm on the 25th in New York, which
  // is 00:00 UTC on the 26th.
  it("is not late the evening before, which is when it used to turn red", () => {
    expect(isPastDue(DUE_26TH, new Date("2026-08-26T00:00:01Z"))).toBe(false);
  });

  it("stays late long afterwards", () => {
    expect(isPastDue(DUE_26TH, new Date("2026-12-01T00:00:00Z"))).toBe(true);
  });
});

describe("daysUntilDue", () => {
  it("is zero on the day", () => {
    expect(daysUntilDue(DUE_26TH, new Date("2026-08-26T18:00:00Z"))).toBe(0);
  });

  it("counts forward", () => {
    expect(daysUntilDue(DUE_26TH, new Date("2026-08-19T00:00:00Z"))).toBe(7);
  });

  it("goes negative once it has passed", () => {
    expect(daysUntilDue(DUE_26TH, new Date("2026-08-29T00:00:00Z"))).toBe(-3);
  });

  // Times of day must not turn a whole day into a fraction that rounds wrong.
  it("ignores the time of day at both ends", () => {
    expect(daysUntilDue(DUE_26TH, new Date("2026-08-25T23:59:00Z"))).toBe(1);
    expect(daysUntilDue(DUE_26TH, new Date("2026-08-25T00:01:00Z"))).toBe(1);
  });
});
