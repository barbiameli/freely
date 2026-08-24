import { describe, it, expect } from "vitest";
import { pickThree, roundToStep, parseLevels, asLevel } from "@/lib/market-rate";

describe("pickThree", () => {
  it("offers a low, a middle and a high", () => {
    expect(pickThree({ low: 300, high: 700 })).toEqual([300, 500, 700]);
  });

  it("puts the middle exactly between them", () => {
    const [low, middle, high] = pickThree({ low: 40, high: 80 });
    expect(middle - low).toBe(high - middle);
  });

  it("copes with a range given backwards", () => {
    expect(pickThree({ low: 700, high: 300 })).toEqual([300, 500, 700]);
  });

  // Three identical chips is a choice that is not one.
  it("collapses a range too narrow to round into three numbers", () => {
    expect(pickThree({ low: 61, high: 62 })).toEqual([60]);
  });

  it("offers two when only two survive rounding", () => {
    expect(pickThree({ low: 61, high: 63 })).toEqual([60, 65]);
  });

  it("keeps them in order", () => {
    const values = pickThree({ low: 55, high: 120 });
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

describe("roundToStep", () => {
  // Nobody quotes £427 a day, and that much precision claims a confidence the
  // research does not have.
  it("rounds an hourly figure to the nearest five", () => {
    expect(roundToStep(63)).toBe(65);
    expect(roundToStep(61)).toBe(60);
  });

  it("rounds a day rate to the nearest ten", () => {
    expect(roundToStep(427)).toBe(430);
  });

  it("rounds a fixed price to the nearest fifty", () => {
    expect(roundToStep(2437)).toBe(2450);
  });

  it("never rounds a real number down to nothing", () => {
    expect(roundToStep(1)).toBe(5);
  });
});

describe("parseLevels", () => {
  const good = {
    Junior: { low: 200, high: 320 },
    "Mid-level": { low: 320, high: 460 },
    Senior: { low: 460, high: 700 },
    Expert: { low: 700, high: 1100 },
  };

  it("reads a complete answer", () => {
    expect(parseLevels(good)).toEqual(good);
  });

  it("puts a backwards range the right way round", () => {
    const levels = parseLevels({ ...good, Senior: { low: 700, high: 460 } });
    expect(levels?.Senior).toEqual({ low: 460, high: 700 });
  });

  // Refused rather than patched up. A half-parsed range would put an invented
  // number in front of somebody deciding what to charge.
  it("refuses an answer missing a level", () => {
    const { Expert, ...missing } = good;
    void Expert;
    expect(parseLevels(missing)).toBeNull();
  });

  it("refuses a level that is not two numbers", () => {
    expect(parseLevels({ ...good, Junior: { low: "200", high: 320 } })).toBeNull();
    expect(parseLevels({ ...good, Junior: { low: 200 } })).toBeNull();
  });

  it("refuses zero and negative rates", () => {
    expect(parseLevels({ ...good, Junior: { low: 0, high: 320 } })).toBeNull();
    expect(parseLevels({ ...good, Junior: { low: -5, high: 320 } })).toBeNull();
  });

  // The realistic failure: an annual salary where a day rate was asked for
  // reads as a plausible number and is wrong by a factor of two hundred.
  it("refuses a figure large enough to be the wrong unit", () => {
    expect(parseLevels({ ...good, Expert: { low: 700, high: 250_000 } })).toBeNull();
  });

  it("refuses nothing at all", () => {
    expect(parseLevels(null)).toBeNull();
    expect(parseLevels("400 to 700")).toBeNull();
    expect(parseLevels([])).toBeNull();
  });
});

describe("asLevel", () => {
  it("accepts the four levels", () => {
    expect(asLevel("Junior")).toBe("Junior");
    expect(asLevel("Mid-level")).toBe("Mid-level");
  });

  it("refuses anything else that arrives from a form", () => {
    expect(asLevel("junior")).toBeNull();
    expect(asLevel("Principal")).toBeNull();
    expect(asLevel(undefined)).toBeNull();
  });
});
