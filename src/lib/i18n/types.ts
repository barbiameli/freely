/**
 * Languages, and the shape a dictionary has to satisfy.
 *
 * The English dictionary is the source of truth: its type is derived from the
 * object itself, and every other language must match that type exactly. A
 * missing Spanish key is a TypeScript error rather than a string that silently
 * falls back to English and ships looking half-finished.
 */
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function parseLocale(value?: string | null): Locale {
  return value === "es" ? "es" : "en";
}

/**
 * Picks a language from an Accept-Language header.
 *
 * Only used the first time someone arrives, to save them a trip to settings.
 * Anything they choose afterwards wins and is stored on the account.
 */
export function localeFromHeader(header?: string | null): Locale {
  if (!header) return "en";
  // "es-419,es;q=0.9,en;q=0.8" — first tag wins, region ignored.
  const first = header.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return first === "es" ? "es" : "en";
}

/** Keys whose value takes arguments, so a sentence can have a number or a
 * name in the middle of it rather than being glued together from fragments,
 * which does not survive translation. */
export type Interpolator = (values: Record<string, string | number>) => string;
