import { en, type Dictionary } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";
import { parseLocale, type Locale } from "@/lib/i18n/types";

export * from "@/lib/i18n/types";
export type { Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

/**
 * The strings for a language.
 *
 * Returns the whole dictionary rather than a lookup function, so a component
 * reads `t.quote.yourRate` and a typo is a compile error. A `t("quote.yourRate")`
 * signature would take a string and hand back `undefined` at runtime.
 */
export function dict(locale: Locale | string | null | undefined): Dictionary {
  return DICTIONARIES[parseLocale(locale)];
}

/**
 * Fills placeholders in a translated string.
 *
 * Some sentences need a number or a name in the middle, and gluing fragments
 * together works in English then breaks in a language with different word
 * order. The whole sentence stays in the dictionary with {placeholders}.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    key in values ? String(values[key]) : whole
  );
}
