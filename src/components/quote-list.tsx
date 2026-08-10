"use client";

import { BriefCard, type BriefSummary } from "@/components/brief-card";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n/context";
import { fill } from "@/lib/i18n";

/**
 * Every quote, as cards.
 *
 * Lives under the All quotes tab on the wizard page. Took over from the
 * separate /quote/all route, which existed because the carousel could only
 * show a handful.
 */
export function QuoteList({
  briefs,
  onStartNew,
}: {
  briefs: BriefSummary[];
  onStartNew: () => void;
}) {
  const t = useT();
  const drafts = briefs.filter((b) => b.status !== "TRACKED");

  if (briefs.length === 0) {
    return (
      <Card>
        <div className="text-slate text-body">
          {t.quote.nothingHereYet}{" "}
          <button
            type="button"
            onClick={onStartNew}
            className="font-body font-semibold text-body text-violet bg-none border-none cursor-pointer p-0 underline"
          >
            {t.quote.makeYourFirst}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <p className="text-slate text-small m-0">
        {fill(drafts.length > 0 ? t.quote.countWithDrafts : t.quote.count, {
          count: briefs.length,
          drafts: drafts.length,
        })}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {briefs.map((brief) => (
          <BriefCard key={brief.id} brief={brief} />
        ))}
      </div>
    </>
  );
}
