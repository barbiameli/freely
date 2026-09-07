"use client";

import { useState } from "react";
import { CalendarRange, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import { useT } from "@/lib/i18n/context";
import { autoScheduleAction, placeTaskAction } from "@/actions/board";
import { barFor, dayColumns, dayKey, type PlannedTask } from "@/lib/timeline-plan";

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
const DAY_WIDTH = 44;

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
    if (!result.ok) setError(result.error);
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
    setNote(
      result.data.overrunDays > 0
        ? t.track.timelineOverruns.replace("{days}", String(result.data.overrunDays))
        : t.track.timelineFits
    );
  }

  const unplaced = tasks.filter((task) => !task.plannedStart || !task.plannedEnd);

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
      {unplaced.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-caption text-text-muted">{t.track.timelineUnplaced}</span>
          {unplaced.map((task) => (
            <span
              key={task.id}
              draggable
              onDragStart={() => setDragging(task)}
              onDragEnd={() => setDragging(null)}
              className={`inline-block rounded-full border px-2.5 py-1 text-caption font-semibold cursor-grab ${
                tint.get(task.deliverableId) ?? TINTS[0]
              }`}
            >
              {task.name}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <div style={{ minWidth: days.length * DAY_WIDTH + 160 }}>
          {/* The dates across the top. */}
          <div className="flex">
            <div className="w-[160px] shrink-0" />
            {days.map((day) => (
              <div
                key={day.toISOString()}
                style={{ width: DAY_WIDTH }}
                className={`shrink-0 text-center text-caption py-1 ${
                  day.getUTCDay() === 0 || day.getUTCDay() === 6
                    ? "text-text-muted bg-paper"
                    : "text-slate"
                }`}
              >
                {day.getUTCDate()}
              </div>
            ))}
          </div>

          {deliverables.map((deliverable) => {
            const rows = tasks.filter((task) => task.deliverableId === deliverable.id);
            if (rows.length === 0) return null;
            return (
              <div key={deliverable.id} className="flex border-t border-line">
                <div className="w-[160px] shrink-0 py-2.5 pr-3">
                  <span className="font-body font-semibold text-caption text-ink text-pretty">
                    {deliverable.name}
                  </span>
                </div>
                <div className="relative flex-1">
                  {/* The day cells, which are also the drop targets. */}
                  <div className="absolute inset-0 flex" aria-hidden>
                    {days.map((day) => (
                      <div
                        key={day.toISOString()}
                        style={{ width: DAY_WIDTH }}
                        className={`shrink-0 border-r border-line/60 ${
                          day.getUTCDay() === 0 || day.getUTCDay() === 6 ? "bg-paper" : ""
                        }`}
                      />
                    ))}
                  </div>

                  <div className="relative flex flex-col gap-1 py-2">
                    {rows.map((task) => {
                      const bar = barFor(task, startDate);
                      if (!bar) return <div key={task.id} className="h-[26px]" />;
                      return (
                        <div key={task.id} className="h-[26px] relative">
                          <div
                            draggable
                            onDragStart={() => setDragging(task)}
                            onDragEnd={() => setDragging(null)}
                            style={{
                              marginLeft: bar.offset * DAY_WIDTH,
                              width: bar.days * DAY_WIDTH - 4,
                            }}
                            className={`h-[26px] rounded-lg border px-2 flex items-center cursor-grab active:cursor-grabbing ${
                              tint.get(task.deliverableId) ?? TINTS[0]
                            } ${task.done ? "opacity-60" : ""}`}
                          >
                            <span className="truncate text-caption font-semibold">{task.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sits above the cells so a drop anywhere in the row lands
                      on the day under the pointer. */}
                  <div className="absolute inset-0 flex">
                    {days.map((day) => (
                      <div
                        key={day.toISOString()}
                        style={{ width: DAY_WIDTH }}
                        className="shrink-0"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragging && !busy) void place(dragging, day);
                          setDragging(null);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
