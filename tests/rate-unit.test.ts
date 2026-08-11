import { describe, it, expect } from "vitest";
import {
  parseRateUnit,
  unitsFromHours,
  hoursFromUnits,
  priceFor,
  describeEffort,
  rateSuffix,
  effortLabel,
  rateLabel,
  effortShort,
  HOURS_PER_DAY,
} from "@/lib/rate-unit";
import { applyHourlyRate } from "@/lib/anthropic";
import { dict } from "@/lib/i18n";
import { repriceForHours, effectiveRate } from "@/lib/repricing";

describe("rate unit", () => {
  it("defaults to hourly for anything unrecognised", () => {
    expect(parseRateUnit(null)).toBe("HOUR");
    expect(parseRateUnit("weekly")).toBe("HOUR");
    expect(parseRateUnit("DAY")).toBe("DAY");
  });

  it("converts hours to days and back", () => {
    expect(unitsFromHours(40, "DAY")).toBe(5);
    expect(hoursFromUnits(5, "DAY")).toBe(5 * HOURS_PER_DAY);
    expect(unitsFromHours(40, "HOUR")).toBe(40);
  });

  it("prices days by the day", () => {
    // 40 hours is 5 days, so at 520/day the total is 2600, not 40 x 520.
    expect(priceFor(40, 520, "DAY")).toBe(2600);
    expect(priceFor(40, 65, "HOUR")).toBe(2600);
  });

  it("reads the effort in the unit it was quoted in", () => {
    expect(describeEffort(40, "DAY", EN)).toBe("5 days");
    expect(describeEffort(8, "DAY", EN)).toBe("1 day");
    expect(describeEffort(40, "HOUR", EN)).toBe("40 hours");
    expect(rateSuffix("DAY", EN)).toBe("/day");
  });

  it("reads it in the client's language, since the client is who reads it", () => {
    // The bug: a quote written in Spanish arrived at the client saying
    // "40 hours" and "Per hour" under Spanish headings, because every word
    // in here was an English literal.
    expect(describeEffort(40, "DAY", ES)).toBe("5 días");
    expect(describeEffort(8, "DAY", ES)).toBe("1 día");
    expect(describeEffort(40, "HOUR", ES)).toBe("40 horas");
    expect(rateSuffix("DAY", ES)).toBe("/día");
    expect(rateSuffix("HOUR", ES)).toBe("/h");
  });
});

describe("day rates through the pricing rules", () => {
  const brief = {
    title: "t",
    client: "c",
    scope: "s",
    deliverables: ["d"],
    timeline: "t",
    price: 9999,
    hours: 40,
  };

  it("enforces the day rate at generation", () => {
    expect(applyHourlyRate(brief, 520, "DAY").price).toBe(2600);
  });

  it("reprices in days when the hours are edited", () => {
    expect(repriceForHours(80, 2600, 40, 520, "DAY")?.price).toBe(5200);
  });

  it("implies a day rate from the numbers when none was stored", () => {
    // 2600 across 5 days is 520 a day, not 65.
    expect(effectiveRate(2600, 40, null, "DAY")).toBe(520);
  });
});

const EN = dict("en").publicQuote;
const ES = dict("es").publicQuote;

describe("labels never disagree with the numbers", () => {
  it("labels a day-rate quote in days", () => {
    // The bug: a 400/day quote showed "40h" and "PER HOUR" beside a 2,000
    // total, which only makes sense as days and reads as a mistake.
    expect(effortLabel("DAY", EN)).toBe("Estimated days");
    expect(rateLabel("DAY", EN)).toBe("Per day");
    expect(effortShort(40, "DAY")).toBe("5d");
  });

  it("still labels an hourly quote in hours", () => {
    expect(effortLabel("HOUR", EN)).toBe("Estimated hours");
    expect(rateLabel("HOUR", EN)).toBe("Per hour");
    expect(effortShort(40, "HOUR")).toBe("40h");
  });

  it("agrees with the total it is shown next to", () => {
    // 40 hours at 400 a day is 5 days and 2,000, and the label has to say so.
    const hours = 40;
    const rate = 400;
    expect(priceFor(hours, rate, "DAY")).toBe(2000);
    expect(effortShort(hours, "DAY")).toBe("5d");
  });
});
