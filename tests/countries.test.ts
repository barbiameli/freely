import { describe, it, expect } from "vitest";
import {
  COUNTRIES,
  countryName,
  currencyForCountry,
  isKnownCountry,
  countryForCurrency,
  resolveCountry,
} from "@/lib/countries";
import { CURRENCIES } from "@/lib/currencies";

describe("the country list", () => {
  it("has no duplicate codes", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("is sorted by name, since a person reads it as a list", () => {
    const names = COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort());
  });

  // The thing most likely to break this: adding a country with a currency
  // that has no symbol, so a price renders as "PLN 4,500" in the middle of an
  // otherwise finished quote.
  it("only maps to currencies the app can render", () => {
    const known = new Set(CURRENCIES.map((c) => c.code));
    for (const country of COUNTRIES) {
      expect(known.has(country.currency), `${country.name} -> ${country.currency}`).toBe(true);
    }
  });

  it("uses two-letter codes", () => {
    for (const country of COUNTRIES) expect(country.code).toMatch(/^[A-Z]{2}$/);
  });
});

describe("currencyForCountry", () => {
  it("knows the obvious ones", () => {
    expect(currencyForCountry("GB")).toBe("GBP");
    expect(currencyForCountry("ES")).toBe("EUR");
    expect(currencyForCountry("JP")).toBe("JPY");
  });

  it("falls back to dollars for anything it does not know", () => {
    expect(currencyForCountry("ZZ")).toBe("USD");
    expect(currencyForCountry(null)).toBe("USD");
    expect(currencyForCountry("")).toBe("USD");
  });
});

describe("countryName", () => {
  it("reads as a name", () => {
    expect(countryName("PT")).toBe("Portugal");
  });

  it("returns null when there is nothing to name", () => {
    expect(countryName(null)).toBeNull();
    expect(countryName("")).toBeNull();
  });

  // An account saved before a country left the list still shows something.
  it("falls back to the code rather than to nothing", () => {
    expect(countryName("ZZ")).toBe("ZZ");
  });
});

describe("countryForCurrency", () => {
  it("guesses a country for everybody who was never asked", () => {
    expect(countryForCurrency("GBP")).toBe("GB");
    expect(countryForCurrency("BRL")).toBe("BR");
    expect(countryForCurrency("CHF")).toBe("CH");
  });

  it("resolves the two ambiguous ones to their largest market", () => {
    expect(countryForCurrency("EUR")).toBe("DE");
    expect(countryForCurrency("USD")).toBe("US");
  });

  it("never returns nothing, since it feeds a cache key", () => {
    expect(countryForCurrency(null)).toBe("US");
    expect(countryForCurrency("XYZ")).toBe("US");
  });

  it("guesses a country that is in the list", () => {
    for (const currency of CURRENCIES) {
      expect(isKnownCountry(countryForCurrency(currency.code))).toBe(true);
    }
  });
});

describe("resolveCountry", () => {
  it("prefers what they told us", () => {
    expect(resolveCountry("PT", "EUR")).toBe("PT");
  });

  it("falls back to the currency when nobody asked", () => {
    expect(resolveCountry(null, "GBP")).toBe("GB");
  });

  // A stored code that has since left the list would otherwise become a cache
  // bucket and a line in a prompt that neither the cache nor the model can
  // make sense of.
  it("does not trust a code the list no longer has", () => {
    expect(resolveCountry("ZZ", "SEK")).toBe("SE");
  });

  it("has an answer when it has nothing at all", () => {
    expect(resolveCountry(null, null)).toBe("US");
  });
});
