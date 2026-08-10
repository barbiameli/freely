"use client";

import { useT } from "@/lib/i18n/context";

export type QuoteTab = "new" | "all";

/**
 * The two things you come to Quote to do.
 *
 * This replaced a carousel of recent quotes pinned above the wizard. The
 * carousel took the top of the screen on every visit, including the visits
 * where you came to start something new, and it only ever showed a slice of
 * the list with a "see all" link to the rest. Two tabs give the list a place
 * of its own and give the wizard the top of the page back.
 */
export function QuoteTabs({
  value,
  onChange,
  count,
}: {
  value: QuoteTab;
  onChange: (tab: QuoteTab) => void;
  count: number;
}) {
  const t = useT();

  const tabs: { id: QuoteTab; label: string; badge?: number }[] = [
    { id: "new", label: t.quote.newQuote },
    { id: "all", label: t.quote.allQuotes, badge: count },
  ];

  return (
    <div role="tablist" aria-label={t.nav.quote} className="flex items-center gap-1 border-b border-line">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`font-body font-semibold text-small bg-none border-none cursor-pointer px-3.5 py-2.5 -mb-px border-b-2 transition-colors ${
              active
                ? "text-ink border-b-violet"
                : "text-text-muted border-b-transparent hover:text-slate"
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`ml-1.5 tabular-nums text-caption ${
                  active ? "text-violet" : "text-text-muted"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
