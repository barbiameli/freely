"use client";

import { Check } from "lucide-react";
import { formatDay, relativeDay, daysBetween, isPastDue } from "@/lib/schedule";
import { cheerFor } from "@/lib/cheer";
import { useT, useLocale } from "@/lib/i18n/context";

/** Due, and not ticked. A named helper because the guard against hardcoded JSX
 * text reads an inline `<` comparison as text between tags. */
function isLate(marker: TimelineMarker, now: Date): boolean {
  // Not late during the day it is due. Comparing instants made something due
  // on the 26th turn red at midnight UTC, which is the evening of the 25th
  // for anybody in the Americas.
  return !marker.done && isPastDue(marker.dueAt, now);
}

export interface TimelineMarker {
  id: string;
  name: string;
  dueAt: Date;
  done: boolean;
  /** When it was ticked. Null on anything finished before this was recorded,
   * which is why nothing here depends on it being present. */
  doneAt?: Date | null;
}

/**
 * The project on a line, with a marker per deliverable and where today sits.
 *
 * A list of dates makes you do the arithmetic. A line does it for you: how much
 * of the run is gone, what is bunched up at the end, what has already slipped
 * past today without being ticked.
 *
 * It used to be a 6px rail with 10px dots, and ticking something off changed one
 * dot from coral to green. Nobody noticed, which is a waste of the one moment in
 * the whole app that is unambiguously good news. So finishing something is now
 * the loudest thing on the line: the done markers are filled discs with a tick
 * in them, they land with a small pop, and the bar fills solid behind them.
 *
 * Two things are drawn on one line and they are not the same thing, so they are
 * drawn differently. Progress is how much of the work is done, and it is the
 * violet fill. Today is a position in time, and it is a full-height marker. A
 * project can be 80% done in the first week or 20% done in the last, and the gap
 * between those two is the thing worth seeing at a glance.
 */
export function TimelineBar({
  startDate,
  dueDate,
  markers,
  now = new Date(),
}: {
  startDate: Date;
  dueDate: Date;
  markers: TimelineMarker[];
  now?: Date;
}) {
  const t = useT();
  const locale = useLocale();
  const span = Math.max(1, daysBetween(startDate, dueDate));
  const at = (date: Date) =>
    Math.min(100, Math.max(0, (daysBetween(startDate, date) / span) * 100));
  const todayAt = at(now);
  const past = now > dueDate;

  const done = markers.filter((m) => m.done);
  const overdue = markers.filter((m) => isLate(m, now));
  const allDone = markers.length > 0 && done.length === markers.length;

  // The fill reaches the furthest thing finished, which is what "done" means on
  // a line of work. Reaching today instead would show a project with nothing
  // ticked as most of the way along.
  const doneTo = done.length > 0 ? Math.max(...done.map((m) => at(m.dueAt))) : 0;

  // One dry line about where this actually is. See lib/cheer: earned from the
  // real numbers, deterministic, and absent on the ordinary middle of a
  // project, which is most days.
  const elapsedDays = daysBetween(startDate, now);
  const cheer = cheerFor({
    total: markers.length,
    done: done.length,
    overdue: overdue.length,
    doneToday: markers.filter((m) => m.doneAt && daysBetween(m.doneAt, now) === 0).length,
    elapsed: Math.min(1, Math.max(0, elapsedDays / span)),
    daysToDue: daysBetween(now, dueDate),
  });
  const cheerLine = cheer
    ? t.track[cheer.key].replace("{count}", String(cheer.count ?? ""))
    : null;

  return (
    <div>
      {/* The count, loud, because it is the answer to the question somebody
          opened this card to ask. The dates were the largest thing here and they
          are the least interesting: they do not change. */}
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div
            className={`font-body font-bold text-title tabular-nums ${
              allDone ? "text-success" : "text-ink"
            }`}
          >
            {allDone
              ? t.track.allDone
              : t.track.doneOf
                  .replace("{done}", String(done.length))
                  .replace("{total}", String(markers.length))}
          </div>
          {/* The line replaces the bare overdue count rather than sitting next
              to it: "2 past the date" and "2 past the date, start with the
              smallest" is the same fact twice, and only one of them is useful. */}
          {cheerLine && (
            <div
              className={`text-small mt-0.5 ${
                cheer?.good ? "text-slate" : "text-overdue font-semibold"
              }`}
            >
              {cheerLine}
            </div>
          )}
        </div>
        <div className="text-caption text-text-muted tabular-nums text-right shrink-0">
          <div>{formatDay(startDate, locale)}</div>
          <div className={past ? "text-overdue font-semibold" : ""}>
            {formatDay(dueDate, locale)} · {relativeDay(dueDate, now, locale)}
          </div>
        </div>
      </div>

      {/* Taller, so the markers sit in it rather than on it. */}
      <div className="relative h-2.5 rounded-full bg-line mt-6 mb-1">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-marketing motion-reduce:transition-none ${
            allDone ? "bg-success" : "bg-violet"
          }`}
          style={{ width: `${doneTo}%` }}
        />
        {/* Today, as a full-height marker rather than a dot, so it reads as a
            position on the line rather than another deliverable. */}
        <div
          className="absolute -top-1.5 bottom-[-6px] w-[2px] bg-ink rounded-full"
          style={{ left: `${todayAt}%` }}
          title={`${t.track.today}, ${formatDay(now, locale)}`}
        />
        {markers.map((m) => {
          const late = isLate(m, now);
          return (
            <div
              key={m.id}
              title={`${m.name} · ${formatDay(m.dueAt, locale)}`}
              style={{ left: `${at(m.dueAt)}%` }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            >
              {m.done ? (
                // Bigger than the others, with a tick in it, and it pops as it
                // arrives. Finishing something should be the loudest event here.
                <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-success border-2 border-white shadow-panel animate-pop motion-reduce:animate-none">
                  <Check size={10} strokeWidth={3.5} className="text-white" />
                </span>
              ) : (
                <span
                  className={`block w-3 h-3 rounded-full border-2 border-white ${
                    late ? "bg-overdue" : "bg-coral"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Only the states actually on the line. A legend explaining a colour
          that is not there is three words of housekeeping. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-caption text-text-muted">
        {done.length < markers.length && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-coral" /> {t.track.due}
          </span>
        )}
        {done.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" /> {t.track.done}
          </span>
        )}
        {overdue.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-overdue" /> {t.track.pastTheDate}
          </span>
        )}
      </div>
    </div>
  );
}
