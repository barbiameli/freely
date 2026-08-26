import { describe, it, expect } from "vitest";
import {
  formatAmount,
  formatMoney,
  invoiceTotals,
  minorUnits,
  roundTo,
  localeTag,
} from "@/lib/money";

describe("the number follows the reader, not the server", () => {
  // The bug: the invoice PDF localised its dates and not its numbers, so a
  // Spanish invoice printed "26 de agosto de 2026" next to "1,234.50". The
  // number went through toLocaleString with no locale, which on a server means
  // the server's locale rather than the reader's.
  it("uses a decimal comma in Spanish", () => {
    expect(formatAmount(1234.5, "EUR", "es")).toBe("1234,50");
  });

  it("uses a decimal point in English", () => {
    expect(formatAmount(1234.5, "EUR", "en")).toBe("1,234.50");
  });

  it("does not fall back to whichever machine is running", () => {
    // Same input, two languages, two answers. If this ever returns the same
    // string twice the locale is being ignored again.
    expect(formatAmount(1234.5, "EUR", "es")).not.toBe(formatAmount(1234.5, "EUR", "en"));
  });

  it("defaults to English when nothing is given", () => {
    expect(formatAmount(1234.5, "EUR")).toBe("1,234.50");
  });
});

describe("currencies without a minor unit", () => {
  // "¥1,234.50" is not a smaller amount of money, it is not an amount of
  // money. The yen has no minor unit.
  it("prints yen with no decimal places", () => {
    expect(formatAmount(1234.5, "JPY", "en")).toBe("1,235");
    expect(minorUnits("JPY")).toBe(0);
  });

  it("prints everything else with two", () => {
    expect(minorUnits("EUR")).toBe(2);
    expect(minorUnits("GBP")).toBe(2);
    expect(minorUnits(null)).toBe(2);
  });
});

describe("formatMoney", () => {
  it("puts the symbol in front of the number", () => {
    expect(formatMoney(4500, "EUR", "en")).toBe("€4,500.00");
  });

  // It used to ask for no fraction digits at all, so a price of 1234.5
  // rendered as "£1,234.5", which looks like a bug because it is one.
  it("always shows the pennies", () => {
    expect(formatMoney(1234.5, "GBP", "en")).toBe("£1,234.50");
    expect(formatMoney(1234, "GBP", "en")).toBe("£1,234.00");
  });
});

describe("roundTo", () => {
  it("rounds to the currency's precision", () => {
    expect(roundTo(1234.567, "GBP")).toBe(1234.57);
    expect(roundTo(1234.567, "JPY")).toBe(1235);
  });

  it("clears the float dust that multiplication leaves", () => {
    expect(roundTo(0.1 * 3, "GBP")).toBe(0.3);
  });
});

describe("invoiceTotals", () => {
  // The point of all of it: an invoice is added up by the person paying it.
  // If each line is rounded for display but the total is computed from the
  // unrounded values, the printed numbers can fail to add up by a penny, and
  // a client who checks finds an invoice that is wrong and unexplainable.
  it("makes the printed lines add up to the printed total", () => {
    const lines = [33.333, 33.333, 33.334];
    const { subtotal, tax, total } = invoiceTotals(lines, 21, "GBP");

    const printedLines = lines.map((l) => roundTo(l, "GBP"));
    expect(printedLines.reduce((a, b) => a + b, 0)).toBeCloseTo(subtotal, 10);
    expect(roundTo(subtotal + tax, "GBP")).toBe(total);
  });

  it("adds no tax row when there is no tax", () => {
    expect(invoiceTotals([100], 0, "GBP")).toEqual({ subtotal: 100, tax: 0, total: 100 });
  });

  it("works out ordinary VAT", () => {
    expect(invoiceTotals([1000], 21, "EUR")).toEqual({
      subtotal: 1000,
      tax: 210,
      total: 1210,
    });
  });

  it("rounds tax to the currency, not to two places regardless", () => {
    const { tax } = invoiceTotals([1234], 10, "JPY");
    expect(Number.isInteger(tax)).toBe(true);
  });

  it("copes with an empty invoice rather than producing NaN", () => {
    expect(invoiceTotals([], 21, "GBP")).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });
});

describe("localeTag", () => {
  it("maps Freely's two languages", () => {
    expect(localeTag("es")).toBe("es-ES");
    expect(localeTag("en")).toBe("en-GB");
  });

  it("falls back to English rather than to the machine", () => {
    expect(localeTag(null)).toBe("en-GB");
    expect(localeTag(undefined)).toBe("en-GB");
  });
});
