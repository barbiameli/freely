"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { sayDuration } from "@/lib/time-tracking";
import { busiestSeconds, weekOf, weekSeconds, type WeekEntry } from "@/lib/time-week";
import { TimeLog } from "@/components/track/time-log";

/**
 * The week, as a shape rather than a receipt.
 *
 * A list of durations tells you Tuesday had six hours in it. A week tells you
 * which day had none, which afternoon swallowed the estimate, and that a
 * project everybody thought was finished is still taking Thursdays.
 *
 * Days rather than an hour grid. An hour grid is a calendar and Google already
 * is one; what is useful here is how much, on what, and when nothing happened.
 */
export function TimeWeek({
  entries,
  deliverables,
}: {
  entries: WeekEntry[];
  /** For saying what a stretch was spent on, without typing it. */
  deliverables: { id: string; name: string }[];
}) {
  const t = useT();
  /** Weeks back from this one. Zero is the current week. */
  const [back, setBack] = useState(0);

  const anchor = new Date(Date.now() - back * 7 * 86_400_000);
  const days = weekOf(entries, anchor);
  const tallest = busiestSeconds(days);
  const total = weekSeconds(days);

  const labels = [
    t.track.mon,
    t.track.tue,
    t.track.wed,
    t.track.thu,
    t.track.fri,
    t.track.sat,
    t.track.sun,
  ];

  const [open, setOpen] = useState<string | null>(null);
  const openDay = days.find((day) => day.date === open) ?? null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="font-body font-semibold text-small text-ink">
          {back === 0 ? t.track.thisWeek : t.track.weekOf.replace(
            "{date}",
            new Date(days[0].date).toLocaleDateString()
          )}
          <span className="text-slate font-normal"> · {sayDuration(total)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setBack((n) => n + 1)}
            aria-label={t.track.weekBack}
            className="p-1.5 rounded-lg text-text-muted hover:text-ink hover:bg-paper border-none bg-none cursor-pointer tap"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            disabled={back === 0}
            onClick={() => setBack((n) => Math.max(0, n - 1))}
            aria-label={t.track.weekForward}
            className="p-1.5 rounded-lg text-text-muted hover:text-ink hover:bg-paper border-none bg-none cursor-pointer tap disabled:opacity-40"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Seven columns at every width. A week that wraps is not a week, and
          the bars stay readable at 360px because they are the only thing in
          the column. */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, index) => {
          const height = tallest > 0 ? Math.round((day.seconds / tallest) * 100) : 0;
          const isOpen = open === day.date;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => setOpen(isOpen ? null : day.date)}
              aria-pressed={isOpen}
              className="flex flex-col items-center gap-1.5 bg-none border-none cursor-pointer p-0 tap"
            >
              <span
                className={`text-caption ${day.isToday ? "font-bold text-ink" : "text-text-muted"}`}
              >
                {labels[index]}
              </span>
              {/* A fixed track with the day drawn inside it, so an empty day
                  is visibly empty rather than absent. */}
              <span className="w-full h-[56px] bg-paper rounded-md flex items-end overflow-hidden">
                <span
                  className={`w-full rounded-md transition-all ${
                    isOpen ? "bg-violet" : day.seconds > 0 ? "bg-violet/45" : "bg-transparent"
                  }`}
                  style={{ height: `${height}%` }}
                />
              </span>
              <span className="text-caption text-slate tabular-nums">
                {day.seconds > 0 ? sayDuration(day.seconds) : ""}
              </span>
            </button>
          );
        })}
      </div>

      {openDay && (
        <div className="mt-4 pt-4 border-t border-line">
          <div className="font-body font-semibold text-small text-ink mb-2">
            {new Date(openDay.date).toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          {openDay.entries.length === 0 ? (
            <p className="text-caption text-text-muted m-0">{t.track.dayEmpty}</p>
          ) : (
            <TimeLog entries={openDay.entries} deliverables={deliverables} />
          )}
        </div>
      )}
    </div>
  );
}
