"use client";

import { useEffect, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { formatDay, relativeDay } from "@/lib/schedule";
import type { Deadline } from "@/lib/project-health";
import { useT, useLocale } from "@/lib/i18n/context";

/**
 * What is due soon, as a note rather than a section.
 *
 * It used to be a card of rows that looked exactly like the deliverables list
 * right beneath it, so the page read as two lists of the same thing and the
 * dates lost their urgency. A tinted, bordered aside instead, distinct from the
 * cards around it.
 *
 * It runs across the page rather than down a 270px rail, where every name was
 * cut to 34 characters, which is not enough to tell "Checkout flow redesign"
 * from "Checkout flow rebuild".
 *
 * One row per deadline, not one column. Three columns divided the width by
 * however many deadlines there happened to be, so two of them left a third of
 * the aside empty and every name got a different amount of room. In rows the
 * date is a column you can read down and the name has the rest of the line.
 *
 * The fade-in is deliberate and slight. Something appearing a beat after the
 * page settles draws the eye once, which is what a deadline reminder is for,
 * without the page seeming to assemble itself.
 */
export function ComingUp({
  deadlines,
  onSelect,
}: {
  deadlines: Deadline[];
  onSelect: (deliverableId: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), 250);
    return () => clearTimeout(timer);
  }, []);

  if (deadlines.length === 0 || dismissed) return null;

  const soonest = deadlines[0];
  const urgent = soonest.overdue || soonest.daysAway <= 2;

  return (
    <aside
      className={`rounded-card border px-4 py-3.5 transition-all duration-500 ease-out ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
      } ${urgent ? "bg-coral-tint border-coral/40" : "bg-paper border-line"}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock size={13} className={urgent ? "text-coral" : "text-slate"} />
          <span className="font-label text-caption uppercase tracking-[0.09em] text-slate">
            {t.track.comingUp}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t.track.hideComingUp}
          className="text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 tap shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {/* Rows rather than columns. Three columns meant two deadlines left a
          third of the aside empty, and every name had a different amount of
          room depending on how many there were. A row per deadline gives the
          date a fixed column that can be read down, the name the rest of the
          line, and the count of days a consistent place at the end. */}
      <div className="flex flex-col">
        {deadlines.slice(0, 3).map((d) => (
          <button
            key={d.deliverableId}
            type="button"
            onClick={() => onSelect(d.deliverableId)}
            className="w-full text-left bg-none border-none cursor-pointer px-0 py-2 first:pt-0 last:pb-0 border-b border-line/60 last:border-b-0 group flex items-baseline gap-3"
          >
            <span
              className={`text-caption tabular-nums shrink-0 w-[52px] ${
                d.overdue ? "text-overdue font-bold" : "text-slate font-semibold"
              }`}
            >
              {formatDay(d.dueAt, locale)}
            </span>
            <span className="font-body font-semibold text-small text-ink leading-snug min-w-0 flex-1 group-hover:text-violet">
              {d.name}
            </span>
            <span
              className={`text-caption tabular-nums shrink-0 ${
                d.overdue ? "text-overdue font-semibold" : "text-text-muted"
              }`}
            >
              {relativeDay(d.dueAt, new Date(), locale)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
