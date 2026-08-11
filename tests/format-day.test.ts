import { describe, it, expect } from "vitest";
import { formatDay, formatLongDay } from "@/lib/schedule";

/**
 * The client's page is the one place a date is read by someone who did not
 * write it, so the month has to be spelled out and in their language. This was
 * hardcoded to en-GB once already, which put "March" on a Spanish page.
 */
describe("formatLongDay", () => {
  const date = new Date("2026-03-12T10:00:00Z");

  it("spells the month out and keeps the year", () => {
    expect(formatLongDay(date, "en")).toBe("12 March 2026");
  });

  it("uses Spanish month names for a Spanish reader", () => {
    expect(formatLongDay(date, "es")).toBe("12 de marzo de 2026");
  });

  it("falls back to English for anything unrecognised", () => {
    expect(formatLongDay(date, "fr")).toBe("12 March 2026");
    expect(formatLongDay(date)).toBe("12 March 2026");
  });
});

describe("formatDay", () => {
  const date = new Date("2026-03-12T10:00:00Z");

  it("stays short, for a run of dates inside the app", () => {
    expect(formatDay(date, "en")).toBe("12 Mar");
    expect(formatDay(date, "es")).toBe("12 mar");
  });
});
