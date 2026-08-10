"use client";

import { useEffect, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { formatDay, relativeDay } from "@/lib/schedule";
import { shortName, type Deadline } from "@/lib/project-health";
import { useT } from "@/lib/i18n/context";

/**
 * What is due soon, as a note rather than a section.
 *
 * It used to be a card of rows that looked exactly like the deliverables list
 * right beneath it, so the page read as two lists of the same thing and the
 * dates lost their urgency. This is a tinted, bordered aside pinned to the side
 * on a wide screen: present, glanceable, and out of the way of the work.
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
          className="text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {deadlines.slice(0, 3).map((d) => (
          <button
            key={d.deliverableId}
            type="button"
            onClick={() => onSelect(d.deliverableId)}
            className="text-left bg-none border-none cursor-pointer p-0 group"
          >
            <div className="text-small text-ink leading-snug group-hover:text-violet">
              {shortName(d.name, 34)}
            </div>
            <div
              className={`text-caption tabular-nums mt-0.5 ${
                d.overdue ? "text-overdue font-semibold" : "text-text-muted"
              }`}
            >
              {formatDay(d.dueAt)} · {relativeDay(d.dueAt)}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
