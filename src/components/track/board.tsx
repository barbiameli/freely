"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, GripVertical, Play, Plus, Square, Trash2, X } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { ActionError } from "@/components/ui/action-error";
import { startTimerAction, stopTimerAction } from "@/actions/time";
import { announceTimerChange } from "@/components/track/timer-bar";
import {
  addTaskAction,
  deleteTaskAction,
  editTaskAction,
  moveStepAction,
} from "@/actions/board";
import {
  COLUMNS,
  boardProgress,
  columnSteps,
  type BoardStep,
  type Column,
} from "@/lib/board";

/**
 * The work as a board rather than a list of lists.
 *
 * Track showed each deliverable with its steps nested underneath, which is the
 * shape of the quote rather than the shape of a day: to find what you are
 * doing now you read six collapsed sections. Three columns answer that in one
 * look, and the deliverable travels with the card as a tag so the grouping is
 * not lost.
 *
 * Dragging is plain HTML5 drag and drop, no library. It costs nothing in the
 * bundle and works with a mouse and a trackpad. It does not work by touch, so
 * every card also carries a move control that does the same thing without a
 * drag: a board you cannot use on a phone is a board you cannot use on the
 * train, and this app is used on a phone.
 */
const TINT: Record<Column, string> = {
  TODO: "bg-paper",
  DOING: "bg-violet-tint",
  DONE: "bg-mint",
};

const DOT: Record<Column, string> = {
  TODO: "bg-text-muted",
  DOING: "bg-violet",
  DONE: "bg-success",
};

/** A stable tint per deliverable, so the tag colour means something. */
const TAGS = [
  "bg-violet/10 text-violet",
  "bg-coral/10 text-coral",
  "bg-success/10 text-success",
  "bg-amber/10 text-amber",
  "bg-ink/10 text-ink",
];

export function Board({
  steps,
  deliverables,
  projectId,
  runningStepId,
  canTrack,
}: {
  steps: BoardStep[];
  /** Names for the tag on each card, keyed by deliverable id. */
  deliverables: { id: string; name: string }[];
  projectId: string;
  /** The task whose clock is running, when it is one of these. */
  runningStepId: string | null;
  /** Whether this engagement has been told what the tracking is for. */
  canTrack: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Column | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** The card being renamed, and the text so far. */
  const [editing, setEditing] = useState<{ id: string; name: string; hours: string } | null>(null);
  /** Which deliverable a new task is being written against. */
  const [adding, setAdding] = useState<{ deliverableId: string; name: string } | null>(null);

  const names = new Map(deliverables.map((d) => [d.id, d.name]));
  const tagClass = new Map(
    deliverables.map((d, i) => [d.id, TAGS[i % TAGS.length]] as const)
  );

  function columnLabel(column: Column): string {
    if (column === "TODO") return t.track.boardTodo;
    if (column === "DOING") return t.track.boardDoing;
    return t.track.boardDone;
  }

  async function move(stepId: string, target: Column, index: number) {
    setBusy(true);
    setError("");
    const result = await moveStepAction(stepId, target, index);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // revalidatePath marks the server cache stale; it does not re-render a
    // client component that is already on screen. Without this the move was
    // saved and the card sprang back, which reads as drag and drop not
    // working at all rather than as a refresh problem.
    router.refresh();
  }

  /**
   * The clock, against one card.
   *
   * Starting from the header records time against the project; starting from
   * a card records it against the task, which is the difference between
   * "eleven hours on Ergo" and knowing four of them went on annotations. One
   * clock at a time, so starting here stops whatever was running.
   */
  async function toggleTimer(card: BoardStep) {
    if (!canTrack) return;
    setBusy(true);
    setError("");
    if (runningStepId === card.id) {
      const result = await stopTimerAction();
      if (result.ok) announceTimerChange(null);
      else setError(result.error);
    } else {
      const result = await startTimerAction(projectId, card.name, {
        id: card.id,
        deliverableId: card.deliverableId,
      });
      if (result.ok) {
        announceTimerChange({
          id: result.data.id,
          projectId,
          projectTitle: "",
          note: card.name,
          startedAt: new Date().toISOString(),
        });
      } else {
        setError(result.error);
      }
    }
    setBusy(false);
    router.refresh();
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setError("");
    const result = await editTaskAction(editing.id, {
      name: editing.name,
      estimateHours: Number(editing.hours) || 0,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function removeTask(id: string) {
    setBusy(true);
    setError("");
    const result = await deleteTaskAction(id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function addTask() {
    if (!adding || !adding.name.trim()) return;
    setBusy(true);
    setError("");
    const result = await addTaskAction(adding.deliverableId, adding.name);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Kept open with the name cleared: somebody adding one task is usually
    // adding three.
    setAdding({ deliverableId: adding.deliverableId, name: "" });
    router.refresh();
  }

  const progress = boardProgress(steps);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-caption text-slate m-0">
          {t.track.boardProgress
            .replace("{done}", String(Math.round(progress.done)))
            .replace("{total}", String(Math.round(progress.total)))}
        </p>
        <ActionError error={error} />
      </div>

      {/* Three columns on anything wide enough, stacked below. A board that
          scrolls sideways on a phone hides two thirds of itself. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
        {COLUMNS.map((column) => {
          const cards = columnSteps(steps, column);
          return (
            <section
              key={column}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOver(column);
              }}
              onDragLeave={() => setOver((c) => (c === column ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (dragging) void move(dragging, column, cards.length);
                setDragging(null);
              }}
              className={`rounded-2xl border p-3 min-h-[120px] transition-colors ${TINT[column]} ${
                over === column ? "border-violet" : "border-line"
              }`}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${DOT[column]}`} aria-hidden />
                <h3 className="font-body font-bold text-caption uppercase tracking-[0.08em] text-ink m-0">
                  {columnLabel(column)}
                </h3>
                <span className="ml-auto text-caption text-text-muted tabular-nums">
                  {cards.length}
                </span>
              </div>

              <ul className="list-none p-0 m-0 flex flex-col gap-2">
                {cards.map((card, index) => (
                  <li
                    key={card.id}
                    draggable={!busy}
                    onDragStart={(e) => {
                      // Required. Without something on the dataTransfer the
                      // browser cancels the drag straight after dragstart, so
                      // no dragover and no drop ever fire and the card simply
                      // does not move. Firefox refuses outright; Chrome is
                      // inconsistent. The payload is unused, the act of
                      // setting it is the point.
                      e.dataTransfer.setData("text/plain", card.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(card.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOver(null);
                      if (dragging && dragging !== card.id) {
                        void move(dragging, column, index);
                      }
                      setDragging(null);
                    }}
                    className={`bg-white rounded-xl border border-line p-2.5 cursor-grab active:cursor-grabbing transition-shadow ${
                      dragging === card.id ? "dragging opacity-90" : "hover:shadow-panel"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical
                        size={13}
                        className="text-text-muted shrink-0 mt-0.5"
                        aria-hidden
                      />
                      {/* Against the card rather than the project, so the
                          hours can answer which task ate the afternoon. Only
                          on work still to do: a clock on a finished task is
                          an invitation to a mistake. */}
                      {canTrack && !card.done && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleTimer(card)}
                          aria-label={runningStepId === card.id ? t.track.stop : t.track.timeStart}
                          className={`shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center border-none cursor-pointer press disabled:opacity-60 ${
                            runningStepId === card.id
                              ? "bg-ink text-white"
                              : "bg-coral-tint text-coral"
                          }`}
                        >
                          {runningStepId === card.id ? (
                            <Square size={9} fill="currentColor" />
                          ) : (
                            <Play size={9} fill="currentColor" />
                          )}
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        {editing?.id === card.id ? (
                          /* In place, because a modal to rename four words is
                             a bigger interruption than the thing it edits. */
                          <div className="flex flex-col gap-1.5">
                            <input
                              autoFocus
                              value={editing.name}
                              onChange={(e) =>
                                setEditing({ ...editing, name: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void saveEdit();
                                if (e.key === "Escape") setEditing(null);
                              }}
                              className="w-full bg-paper rounded-lg border-none px-2 py-1.5 text-sm text-ink outline-none"
                            />
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={editing.hours}
                                onChange={(e) =>
                                  setEditing({ ...editing, hours: e.target.value })
                                }
                                aria-label={t.track.boardHoursLabel}
                                className="w-[64px] bg-paper rounded-lg border-none px-2 py-1 text-caption text-ink outline-none"
                              />
                              <span className="text-caption text-text-muted">
                                {t.track.boardHoursLabel}
                              </span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void saveEdit()}
                                aria-label={t.common.save}
                                className="ml-auto text-success bg-none border-none cursor-pointer p-1 tap"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                                aria-label={t.common.cancel}
                                className="text-text-muted bg-none border-none cursor-pointer p-1 tap"
                              >
                                <X size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void removeTask(card.id)}
                                aria-label={t.common.delete}
                                className="text-text-muted hover:text-overdue bg-none border-none cursor-pointer p-1 tap"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({
                                id: card.id,
                                name: card.name,
                                hours: String(card.estimateHours || 0),
                              })
                            }
                            className={`w-full text-left font-body font-semibold text-small text-pretty bg-none border-none cursor-text p-0 tap-row ${
                              card.done ? "text-slate line-through" : "text-ink"
                            }`}
                          >
                            {card.name}
                          </button>
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-caption font-semibold ${
                              tagClass.get(card.deliverableId) ?? TAGS[0]
                            }`}
                          >
                            {names.get(card.deliverableId) ?? ""}
                          </span>
                          {card.estimateHours > 0 && (
                            <span className="text-caption text-text-muted tabular-nums">
                              {t.track.boardHours.replace("{n}", String(card.estimateHours))}
                            </span>
                          )}
                        </div>

                        {/* The same move, without a drag. Touch does not fire
                            HTML5 drag events, so without this the board is
                            unusable on a phone. */}
                        <div className="flex gap-2 mt-2 md:hidden">
                          {COLUMNS.filter((c) => c !== column).map((c) => (
                            <button
                              key={c}
                              type="button"
                              disabled={busy}
                              onClick={() => void move(card.id, c, 0)}
                              className="text-meta font-semibold text-violet bg-none border-none cursor-pointer p-0 tap disabled:opacity-60"
                            >
                              {t.track.boardMoveTo.replace("{column}", columnLabel(c))}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}

                {cards.length === 0 && (
                  <li className="text-caption text-text-muted py-2">{t.track.boardEmpty}</li>
                )}

                {/* Only in To do. A task you are about to write has not been
                    started and is certainly not finished. */}
                {column === "TODO" && deliverables.length > 0 && (
                  <li>
                    {adding ? (
                      <div className="bg-white rounded-xl border border-line p-2.5 flex flex-col gap-1.5">
                        <select
                          value={adding.deliverableId}
                          onChange={(e) =>
                            setAdding({ ...adding, deliverableId: e.target.value })
                          }
                          aria-label={t.track.boardWhichDeliverable}
                          className="w-full bg-paper rounded-lg border-none px-2 py-1.5 text-caption text-ink outline-none"
                        >
                          {deliverables.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        <input
                          autoFocus
                          value={adding.name}
                          placeholder={t.track.boardTaskName}
                          onChange={(e) => setAdding({ ...adding, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void addTask();
                            if (e.key === "Escape") setAdding(null);
                          }}
                          className="w-full bg-paper rounded-lg border-none px-2 py-1.5 text-sm text-ink outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void addTask()}
                            className="text-meta font-semibold text-violet bg-none border-none cursor-pointer p-0 tap disabled:opacity-60"
                          >
                            {t.common.add}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdding(null)}
                            className="text-meta font-semibold text-slate bg-none border-none cursor-pointer p-0 tap"
                          >
                            {t.common.cancel}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setAdding({ deliverableId: deliverables[0].id, name: "" })
                        }
                        className="w-full inline-flex items-center gap-1.5 text-meta font-semibold text-slate bg-none border-none cursor-pointer p-1 tap-row"
                      >
                        <Plus size={13} />
                        {t.track.boardAddTask}
                      </button>
                    )}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
