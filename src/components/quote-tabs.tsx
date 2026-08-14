"use client";

import { Tabs } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/context";

export type QuoteTab = "new" | "all";

/**
 * The two things you come to Quote to do.
 *
 * This replaced a carousel of recent quotes pinned above the wizard. The
 * carousel took the top of the screen on every visit, including the visits where
 * you came to start something new, and it only ever showed a slice of the list
 * with a "see all" link to the rest. Two tabs give the list a place of its own
 * and give the wizard the top of the page back.
 *
 * The strip itself is the shared one now. This file had its own copy, which is
 * how the same control ended up looking slightly different on three pages.
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

  return (
    <Tabs
      items={[
        { id: "new" as const, label: t.quote.newQuote },
        { id: "all" as const, label: t.quote.allQuotes, badge: count },
      ]}
      value={value}
      onChange={onChange}
      label={t.nav.quote}
    />
  );
}
