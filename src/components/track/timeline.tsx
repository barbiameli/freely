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

/** The deliverable's own bar: solid, so the parent row reads as a header. */
const SOLID = [
  "bg-violet text-white",
  "bg-coral text-white",
  "bg-success text-white",
  "bg-amber text-white",
  "bg-ink text-white",
];

const TINTS = [
  "bg-violet/15 border-violet/40 text-link",
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
  const solid = new Map(deliverables.map((d, i) => [d.id, SOLID[i % SOLID.length]] as const));

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
  const placed = tasks.filter((task) => task.plannedStart && task.plannedEnd);

  /*
   * A row for each deliverable, and its tasks beneath it.
   *
   * The chart was one flat set of lanes, so a fortnight read as thirty
   * unrelated pills and the grouping the client actually agreed to was
   * carried only by a tag colour. It also left every bar one day wide,
   * because at this granularity every individual task is under a day, so the
   * chart said nothing at all about duration.
   *
   * The deliverable's own bar runs from the first of its tasks to the last,
   * so that row is the one that answers how long a piece of work takes. Its
   * tasks sit underneath it, packed into as few lanes as they need.
   *
   * flatMap with an empty array rather than map and a filtering type
   * predicate: the copy scanner reads the angle bracket in a predicate as the
   * start of a JSX tag and reports the type as untranslated text.
   */
  const rows = deliverables.flatMap((deliverable) => {
    const bars = placed
      .filter((task) => task.deliverableId === deliverable.id)
      .flatMap((task) => {
        const bar = barFor(task, startDate);
        return bar ? [bar] : [];
      });
    if (bars.length === 0) return [];
    const from = Math.min(...bars.map((bar) => bar.offset));
    const to = Math.max(...bars.map((bar) => bar.offset + bar.days));
    return [
      {
        deliverable,
        span: { offset: from, days: Math.max(1, to - from) },
        lanes: packLanes(bars),
      },
    ];
  });

  const columns = `repeat(${days.length}, minmax(56px, 1fr))`;

  /** One day cell, which is also where a task can be dropped. */
  function DayCell({ day, tall }: { day: Date; tall?: boolean }) {
    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
    return (
      <div
        className={`${tall ? "min-h-[32px]" : "min-h-[30px]"} border-r border-line/60 ${
          weekend ? "bg-paper" : ""
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
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" icon={Wand2} loading={busy} onClick={planAll}>
          {t.track.timelinePlanIt}
        </Button>
        {note && <p className="text-caption text-slate m-0">{note}</p>}
        <ActionError error={error} />
      </div>

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

      <div className="overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: columns, minWidth: days.length * 56 }}>
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

          {rows.map((row) => (
            <div key={row.deliverable.id} className="col-span-full">
              {/* The deliverable, spanning its whole run. */}
              <div className="grid border-t border-line" style={{ gridTemplateColumns: columns }}>
                {days.map((day, dayIndex) => (
                  <div
                    key={`bg-${row.deliverable.id}-${dayIndex}`}
                    style={{ gridColumn: dayIndex + 1, gridRow: 1 }}
                  >
                    <DayCell day={day} tall />
                  </div>
                ))}
                <div
                  style={{
                    gridColumn: `${row.span.offset + 1} / span ${row.span.days}`,
                    gridRow: 1,
                  }}
                  className={`m-1 h-[24px] rounded-md px-2 flex items-center font-body font-bold text-caption ${
                    solid.get(row.deliverable.id) ?? SOLID[0]
                  }`}
                >
                  <span className="truncate">{row.deliverable.name}</span>
                </div>
              </div>

              {/* Its tasks, set in from the parent bar. */}
              {row.lanes.map((lane, laneIndex) => (
                <div
                  key={`${row.deliverable.id}-lane-${laneIndex}`}
                  className="grid"
                  style={{ gridTemplateColumns: columns }}
                >
                  {days.map((day, dayIndex) => (
                    <div
                      key={`cell-${row.deliverable.id}-${laneIndex}-${dayIndex}`}
                      style={{ gridColumn: dayIndex + 1, gridRow: 1 }}
                    >
                      <DayCell day={day} />
                    </div>
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
                        className={`ml-3 mr-1 my-[3px] h-[22px] rounded-lg border px-2 flex items-center cursor-grab active:cursor-grabbing ${
                          tint.get(task.deliverableId) ?? TINTS[0]
                        } ${task.done ? "opacity-60" : ""}`}
                      >
                        <span className="truncate text-caption">{task.name}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}

          {/* Somewhere to drop the first one, when nothing is placed yet. */}
          {rows.length === 0 && (
            <div
              className="col-span-full grid border-t border-line"
              style={{ gridTemplateColumns: columns }}
            >
              {days.map((day, dayIndex) => (
                <div key={`empty-${dayIndex}`}>
                  <DayCell day={day} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
