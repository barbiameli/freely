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

/**
 * Where a deliberate choice of language is kept.
 *
 * The account column only helps once there is an account, and the marketing
 * page is read by people who do not have one yet. The cookie is written by the
 * switcher in both cases, so it holds the most recent deliberate choice and is
 * checked first.
 */
export const LOCALE_COOKIE = "locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The language a client-facing quote gets written in.
 *
 * Asked once in Memory rather than on every quote. It used to be a pair of
 * chips in the wizard, which put a decision that changes maybe once a year in
 * front of someone every single time they quoted.
 *
 * Unset means follow the interface. That is the right default: someone who
 * works and sells in the same language never has to think about it, and
 * changing the interface language moves the quotes with it rather than leaving
 * them behind on whatever was guessed at signup.
 */
export function resolveQuoteLocale(user: {
  locale?: string | null;
  quoteLocale?: string | null;
}): Locale {
  return parseLocale(user.quoteLocale ?? user.locale);
}

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
