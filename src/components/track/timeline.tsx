"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import { useT } from "@/lib/i18n/context";
import { autoScheduleAction, placeTaskAction } from "@/actions/board";
import { barFor, dayColumns, dayKey, packLanes, type PlannedTask } from "@/lib/timeline-plan";

/**
 * When each task happens, laid against the project's own dates.
 *
 * The board answers "what am I doing now". This answers "will it fit", which
 * is the question freelancers actually get wrong: a fortnight of work agreed
 * into a ten day window, discovered in week two.
 *
 * One row per deliverable, because that is the grouping the client signed,
 * and a column per day, because a two week project is the common case here
 * and a chart with two week-wide columns tells nobody anything.
 *
 * Dropping a card on a day sets its start and keeps its length, which is the
 * move somebody makes ninety per cent of the time. Changing how long
 * something takes is a change to the estimate, and that belongs on the task
 * rather than in a drag nobody can do precisely.
 */

const TINTS = [
  "bg-violet/15 border-violet/40 text-violet",
  "bg-coral/15 border-coral/40 text-coral",
  "bg-success/15 border-success/40 text-success",
  "bg-amber/15 border-amber/40 text-amber",
  "bg-ink/10 border-ink/30 text-ink",
];

export function Timeline({
  projectId,
  tasks,
  deliverables,
  startDate,
  dueDate,
}: {
  projectId: string;
  tasks: PlannedTask[];
  deliverables: { id: string; name: string }[];
  startDate: string | null;
  dueDate: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [dragging, setDragging] = useState<PlannedTask | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  // Nothing to draw against. Said plainly rather than showing an empty grid,
  // because the fix is one field on the project rather than anything here.
  if (!startDate) {
    return (
      <div className="flex items-center gap-2 py-6">
        <CalendarRange size={15} className="text-text-muted shrink-0" />
        <p className="text-small text-slate m-0">{t.track.timelineNeedsDates}</p>
      </div>
    );
  }

  // The span runs to whichever is later, the due date or the last placed bar,
  // so work that overruns is visible rather than cropped off the right edge.
  const placedEnds = tasks
    .map((task) => task.plannedEnd)
    .filter((value): value is string => Boolean(value));
  const lastPlanned = placedEnds.sort().at(-1) ?? null;
  const end = [dueDate, lastPlanned].filter(Boolean).sort().at(-1) ?? startDate;
  const days = dayColumns(startDate, end);

  const tint = new Map(deliverables.map((d, i) => [d.id, TINTS[i % TINTS.length]] as const));

  async function place(task: PlannedTask, day: Date) {
    const span =
      task.plannedStart && task.plannedEnd
        ? Math.max(
            0,
            Math.round(
              (new Date(task.plannedEnd).getTime() - new Date(task.plannedStart).getTime()) /
                86_400_000
            )
          )
        : 0;
    const endDay = new Date(day);
    endDay.setUTCDate(endDay.getUTCDate() + span);

    setBusy(true);
    setError("");
    const result = await placeTaskAction(task.id, dayKey(day), dayKey(endDay));
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // See the note in board.tsx: without this the dates were written and the
    // chart carried on showing the task as unplaced.
    router.refresh();
  }

  async function planAll() {
    setBusy(true);
    setError("");
    setNote("");
    const result = await autoScheduleAction(projectId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    // What got squeezed, not whether it fits. It always fits now: the window
    // was agreed with a client, so the useful sentence is which corners were
    // cut to get there.
    const tight = result.data.squeezed;
    setNote(
      tight.length === 0
        ? t.track.timelineFits
        : t.track.timelineSqueezed
            .replace("{name}", tight[0].name)
            .replace("{has}", String(tight[0].has))
            .replace("{needs}", String(tight[0].needs)) +
            (tight.length > 1
              ? ` ${t.track.timelineSqueezedMore.replace("{count}", String(tight.length - 1))}`
              : "")
    );
  }

  const unplaced = tasks.filter((task) => !task.plannedStart || !task.plannedEnd);
  const byId = new Map(tasks.map((task) => [task.id, task] as const));
  const placed = tasks
    .filter((task) => task.plannedStart && task.plannedEnd)
    // Compared as numbers rather than with a less-than on two strings: the
    // copy scanner reads a bare "<" in a .tsx file as the start of a tag and
    // reports the comparator as untranslated text.
    .sort((a, b) => Date.parse(a.plannedStart!) - Date.parse(b.plannedStart!));

  /*
   * Bars sharing rows where they do not overlap.
   *
   * A row per task drew a thirty-row staircase across a fortnight, mostly
   * empty, and the eye had to travel a screen and a half to read two weeks.
   * The vertical axis carries no meaning of its own here, so a row per bar
   * spends the one dimension that was free. See lib/timeline-plan.
   */
  const lanes = packLanes(
    placed.map((task) => barFor(task, startDate)!).filter(Boolean)
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" icon={Wand2} loading={busy} onClick={planAll}>
          {t.track.timelinePlanIt}
        </Button>
        {note && <p className="text-caption text-slate m-0">{note}</p>}
        <ActionError error={error} />
      </div>

      {/* Anything not yet on the chart, so a task cannot be quietly left out
          of the plan by being invisible. Drag one onto a day to place it. */}
      {/* Folded away. Thirty pills above a two-week grid is a list with a
          chart underneath it, which is the wrong way round. */}
      {unplaced.length > 0 && (
        <details className="group">
          <summary className="text-caption text-text-muted cursor-pointer tap list-none">
            {t.track.timelineUnplacedCount.replace("{count}", String(unplaced.length))}
          </summary>
          <div className="flex flex-wrap gap-1.5 items-center mt-2">
          {unplaced.map((task) => (
            <span
              key={task.id}
              draggable
              onDragStart={(e) => {
                // See board.tsx: without this the drag is cancelled before a
                // drop can happen.
                e.dataTransfer.setData("text/plain", task.id);
                e.dataTransfer.effectAllowed = "move";
                setDragging(task);
              }}
              onDragEnd={() => setDragging(null)}
              className={`inline-block rounded-full border px-2.5 py-1 text-caption font-semibold cursor-grab ${
                tint.get(task.deliverableId) ?? TINTS[0]
              }`}
            >
              {task.name}
            </span>
          ))}
          </div>
        </details>
      )}

      {/*
        * A grid, so the days expand to fill whatever width there is.
        *
        * They were fixed at 44px with the bars positioned by margin, which
        * meant a two-week project drew a narrow strip down the left of a wide
        * screen and every label truncated to two characters. Days are grid
        * columns now with a minimum rather than a fixed size, so twelve of
        * them across a laptop are a hundred pixels each and the names fit.
        */}
      <div className="overflow-x-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${days.length}, minmax(56px, 1fr))`,
            minWidth: days.length * 56,
          }}
        >
          {days.map((day) => (
            <div
              key={`head-${day.toISOString()}`}
              className={`text-center text-caption py-1 ${
                day.getUTCDay() === 0 || day.getUTCDay() === 6
                  ? "text-text-muted bg-paper"
                  : "text-slate"
              }`}
            >
              {day.getUTCDate()}
            </div>
          ))}

          {/* The grid behind the bars, one cell per day per lane. Drawn as
              real cells rather than an absolute overlay so the drop targets
              line up with the columns by construction. */}
          {lanes.map((lane, laneIndex) => (
            <div
              key={`lane-${laneIndex}`}
              className="col-span-full grid border-t border-line"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(56px, 1fr))` }}
            >
              {days.map((day, dayIndex) => (
                <div
                  key={`cell-${laneIndex}-${dayIndex}`}
                  style={{ gridColumn: dayIndex + 1, gridRow: 1 }}
                  className={`min-h-[34px] border-r border-line/60 ${
                    day.getUTCDay() === 0 || day.getUTCDay() === 6 ? "bg-paper" : ""
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragging && !busy) void place(dragging, day);
                    setDragging(null);
                  }}
                />
              ))}

              {lane.map((bar) => {
                const task = byId.get(bar.id);
                if (!task) return null;
                return (
                  <div
                    key={bar.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", task.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(task);
                    }}
                    onDragEnd={() => setDragging(null)}
                    style={{
                      gridColumn: `${bar.offset + 1} / span ${bar.days}`,
                      gridRow: 1,
                    }}
                    className={`m-1 h-[26px] rounded-lg border px-2 flex items-center cursor-grab active:cursor-grabbing ${
                      tint.get(task.deliverableId) ?? TINTS[0]
                    } ${task.done ? "opacity-60" : ""}`}
                  >
                    <span className="truncate text-caption font-semibold">{task.name}</span>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Somewhere to drop the first one, when nothing is placed yet. */}
          {lanes.length === 0 && (
            <div
              className="col-span-full grid border-t border-line"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(56px, 1fr))` }}
            >
              {days.map((day, dayIndex) => (
                <div
                  key={`empty-${dayIndex}`}
                  className="min-h-[34px] border-r border-line/60"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragging && !busy) void place(dragging, day);
                    setDragging(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
