"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/context";
import { updateLocaleAction } from "@/actions/account";

/**
 * Switching language, in the open.
 *
 * It started in the account menu on the reasoning that it is set once and
 * rarely touched. That is true for someone who works in one language, and
 * wrong for anyone who moves between two: they need to see which one they are
 * in without opening a menu to find out.
 *
 * Two letters rather than flags. A flag stands for a country, not a language,
 * and picking one for Spanish means choosing between Spain and everywhere else
 * that speaks it.
 */
export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  function choose(code: string) {
    if (code === locale || switching) return;
    setSwitching(true);
    void updateLocaleAction(code).then(() => {
      setSwitching(false);
      // A full refresh: the language is read on the server and every rendered
      // string has to change.
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={locale === "es" ? "Idioma" : "Language"}
      className={`flex items-center gap-0.5 rounded-full border border-line bg-white p-0.5 ${
        switching ? "opacity-60" : ""
      }`}
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => choose(code)}
            aria-pressed={active}
            title={LOCALE_NAMES[code]}
            className={`font-body font-bold text-caption uppercase rounded-full cursor-pointer border-none transition-colors ${
              compact ? "px-2 py-1" : "px-2.5 py-1"
            } ${active ? "bg-violet text-white" : "bg-transparent text-text-muted hover:text-ink"}`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
