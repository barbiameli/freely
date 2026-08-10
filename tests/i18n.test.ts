import { describe, it, expect } from "vitest";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";
import { dict, fill, parseLocale, localeFromHeader, LOCALES } from "@/lib/i18n";

type Flat = Record<string, string>;

function flatten(source: Record<string, Record<string, string>>): Flat {
  const out: Flat = {};
  for (const [section, entries] of Object.entries(source)) {
    for (const [key, value] of Object.entries(entries)) out[`${section}.${key}`] = value;
  }
  return out;
}

const english = flatten(en as unknown as Record<string, Record<string, string>>);
const spanish = flatten(es as unknown as Record<string, Record<string, string>>);

describe("dictionaries", () => {
  it("has the same keys in both languages", () => {
    // TypeScript already enforces this, but the failure message here names
    // the missing key, which a type error does not do as clearly.
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort());
  });

  it("has no empty strings", () => {
    for (const [key, value] of Object.entries({ ...english, ...spanish })) {
      expect(value.trim(), `${key} is empty`).not.toBe("");
    }
  });

  it("has no Spanish string left in English", () => {
    // Catches a key copied across and never translated. Short shared words
    // (Total, PDF) are legitimately identical, so only longer ones count.
    const untranslated = Object.entries(spanish).filter(
      ([key, value]) => value === english[key] && value.length > 14
    );
    expect(untranslated.map(([key]) => key)).toEqual([]);
  });

  it("keeps placeholders identical between languages", () => {
    const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of Object.keys(english)) {
      expect(placeholders(spanish[key]), `${key} placeholders differ`).toEqual(
        placeholders(english[key])
      );
    }
  });

  it("uses no em dashes, in either language", () => {
    for (const [key, value] of Object.entries({ ...english, ...spanish })) {
      expect(value.includes("—"), `${key} has an em dash`).toBe(false);
    }
  });
});

describe("locale resolution", () => {
  it("falls back to English for anything unrecognised", () => {
    expect(parseLocale(null)).toBe("en");
    expect(parseLocale("fr")).toBe("en");
    expect(parseLocale("es")).toBe("es");
  });

  it("reads a language out of an Accept-Language header", () => {
    expect(localeFromHeader("es-419,es;q=0.9,en;q=0.8")).toBe("es");
    expect(localeFromHeader("en-GB,en;q=0.9")).toBe("en");
    expect(localeFromHeader(null)).toBe("en");
    expect(localeFromHeader("")).toBe("en");
  });

  it("returns a real dictionary for every language", () => {
    for (const code of LOCALES) expect(dict(code).common.save.length).toBeGreaterThan(0);
  });
});

describe("fill", () => {
  it("puts values into a sentence", () => {
    expect(fill("Hola {name}, tienes {count} presupuestos", { name: "Barbara", count: 3 })).toBe(
      "Hola Barbara, tienes 3 presupuestos"
    );
  });

  it("leaves an unknown placeholder alone rather than printing undefined", () => {
    expect(fill("Hola {name}", {})).toBe("Hola {name}");
  });
});

describe("relative dates", () => {
  it("reads naturally in both languages", async () => {
    const { relativeDay, addDays } = await import("@/lib/schedule");
    const now = new Date("2026-01-10T00:00:00Z");
    expect(relativeDay(now, now, "en")).toBe("today");
    expect(relativeDay(now, now, "es")).toBe("hoy");
    // Spanish puts the count in the middle, English at the front, which is
    // why these are whole phrases rather than a shared template.
    expect(relativeDay(addDays(now, 3), now, "en")).toBe("in 3 days");
    expect(relativeDay(addDays(now, 3), now, "es")).toBe("dentro de 3 días");
    expect(relativeDay(addDays(now, -3), now, "es")).toBe("hace 3 días");
    expect(relativeDay(addDays(now, 21), now, "es")).toBe("dentro de 3 semanas");
  });

  it("formats a date in the reader's language", async () => {
    const { formatDay } = await import("@/lib/schedule");
    const date = new Date("2026-03-05T00:00:00Z");
    expect(formatDay(date, "en")).toMatch(/Mar/);
    expect(formatDay(date, "es")).toMatch(/mar/);
  });
});

describe("strings fit where they are rendered", () => {
  /**
   * Spanish runs roughly 20% longer than English, and a few places in the app
   * have a width that cannot give: the nav rail is five items across a phone,
   * and the stat cards are a quarter of the page each.
   *
   * The budgets are characters that fit at the size each is rendered. They are
   * deliberately generous, so a failure means something genuinely will not fit
   * rather than that it got a little longer.
   */
  const budgets: Record<string, number> = {
    "nav.quote": 12,
    "nav.track": 12,
    "nav.diary": 12,
    "nav.invoices": 12,
    "nav.memory": 12,
    "track.done": 14,
    "track.pace": 14,
    "track.nextUp": 14,
    "track.hours": 14,
    "track.paceAhead": 18,
    "track.paceOnTrack": 18,
    "track.paceSlipping": 18,
    "track.paceBehind": 18,
    "track.notScheduled": 18,
    "track.nothingDated": 18,
    "quote.perHour": 14,
    "quote.perDay": 14,
    "common.back": 12,
    "common.continue": 14,
    "quote.stop": 10,
  };

  for (const [key, budget] of Object.entries(budgets)) {
    it(`${key} fits in both languages`, () => {
      for (const [language, table] of [
        ["English", english],
        ["Spanish", spanish],
      ] as const) {
        const value = table[key];
        expect(value, `${key} missing`).toBeDefined();
        expect(
          value.length,
          `${language} "${value}" is ${value.length} characters, budget ${budget}`
        ).toBeLessThanOrEqual(budget);
      }
    });
  }
});
