"use client";

import { createContext, useContext, type ReactNode } from "react";
import { dict, type Dictionary, type Locale } from "@/lib/i18n";

/**
 * The language for everything below it in the tree.
 *
 * Set once in the app layout from the user's saved preference, so a client
 * component reads `useT()` rather than taking a dictionary through props
 * across five levels of component.
 */
const LocaleContext = createContext<{ locale: Locale; t: Dictionary }>({
  locale: "en",
  t: dict("en"),
});

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <LocaleContext.Provider value={{ locale, t: dict(locale) }}>{children}</LocaleContext.Provider>
  );
}

/** The strings, in the current language. */
export function useT(): Dictionary {
  return useContext(LocaleContext).t;
}

/** The current language itself, for date and number formatting. */
export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}
