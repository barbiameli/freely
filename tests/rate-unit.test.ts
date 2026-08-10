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
    expect(describeEffort(40, "DAY")).toBe("5 days");
    expect(describeEffort(8, "DAY")).toBe("1 day");
    expect(describeEffort(40, "HOUR")).toBe("40 hours");
    expect(rateSuffix("DAY")).toBe("/day");
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

describe("labels never disagree with the numbers", () => {
  it("labels a day-rate quote in days", () => {
    // The bug: a 400/day quote showed "40h" and "PER HOUR" beside a 2,000
    // total, which only makes sense as days and reads as a mistake.
    expect(effortLabel("DAY")).toBe("Estimated days");
    expect(rateLabel("DAY")).toBe("Per day");
    expect(effortShort(40, "DAY")).toBe("5d");
  });

  it("still labels an hourly quote in hours", () => {
    expect(effortLabel("HOUR")).toBe("Estimated hours");
    expect(rateLabel("HOUR")).toBe("Per hour");
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
