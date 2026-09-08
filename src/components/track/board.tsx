"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, GripVertical, Play, Plus, Square, Trash2, X } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { ActionError } from "@/components/ui/action-error";
import { setProjectTimeModeAction, startTimerAction, stopTimerAction } from "@/actions/time";
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
  changesFor,
  columnOf,
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
  "bg-violet/10 text-link",
  "bg-coral/10 text-coral",
  "bg-success/10 text-success",
  "bg-amber/10 text-amber",
  "bg-ink/10 text-ink",
];

/**
 * Which column a point is inside, if any.
 *
 * Out here rather than inline in the JSX for two reasons: it is the whole of
 * the drop logic and deserves a name, and the copy scanner reads a bare
 * greater-than inside a .tsx file as the start of a tag and reports the
 * comparison as untranslated text.
 */
function columnAt(
  boxes: Partial<Record<Column, HTMLElement | null>>,
  x: number,
  y: number
): Column | null {
  for (const column of COLUMNS) {
    const box = boxes[column]?.getBoundingClientRect();
    if (!box) continue;
    const inside = x - box.left >= 0 && box.right - x >= 0 && y - box.top >= 0 && box.bottom - y >= 0;
    if (inside) return column;
  }
  return null;
}

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
  /**
   * Where each column is on screen, so a pointer can be turned into a column.
   *
   * Native drag and drop is not used here at all any more. It failed three
   * times for three unrelated reasons, it does not fire on touch, and the
   * whole apparatus exists to drag files between applications rather than to
   * move a card two inches. Pointer events are the same three handlers, work
   * identically with a mouse, a trackpad and a finger, and nothing about them
   * is up to the browser's interpretation.
   */
  const columnRefs = useRef<Partial<Record<Column, HTMLElement | null>>>({});
  /**
   * The card being carried, drawn under the pointer.
   *
   * A drag with no visible card is a guess: the pointer moves, nothing
   * follows it, and the only way to find out whether anything happened is to
   * let go. So a copy of the card is drawn at the cursor while it travels.
   *
   * Only the pointer position and the card's width are kept. An earlier
   * version also stored where within the card it had been grabbed, so it
   * could be carried from that exact point, and that offset was what kept
   * putting it somewhere other than under the cursor. The width stays
   * because a card that shrinks on lift is a different card.
   */
  const [carry, setCarry] = useState<{ x: number; y: number; width: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * The cards as they are on screen right now.
   *
   * A move used to wait for the action and then for a server re-render before
   * the card went anywhere, so dragging a card meant watching it sit still
   * for the better part of a second and then jump. The work was done; the
   * feedback was queued behind a network round trip and a full page render.
   *
   * So the move is applied here first and sent afterwards. If the server
   * refuses, the board goes back to what the server last said and the error
   * is shown, which is the only honest way to be optimistic: the optimism has
   * to be undone when it turns out to be wrong.
   */
  const [local, setLocal] = useState(steps);

  /*
   * Re-sync when the server sends something genuinely different.
   *
   * Keyed on the content rather than the array, because `steps` is a new
   * array on every render of the parent and depending on it directly would
   * overwrite the optimistic move a frame after making it.
   */
  const signature = steps
    .map((step) => `${step.id}:${step.done}:${step.startedAt}:${step.order}`)
    .join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the signature is
  // the point: depending on `steps` itself would fire on every parent render
  // and undo the optimistic move.
  useEffect(() => setLocal(steps), [signature]);
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
    setError("");

    // On screen first. The same change the server is about to make, worked
    // out from the same function, so the optimistic version and the real one
    // cannot disagree about what a move means.
    const changes = changesFor(target);
    setLocal((current) =>
      current.map((step) =>
        step.id === stepId
          ? {
              ...step,
              done: changes.done,
              startedAt: changes.startedAt ? changes.startedAt.toISOString() : null,
              // Last in the column it is arriving in, which is where a
              // dropped card goes.
              order: 9999,
            }
          : step
      )
    );

    const result = await moveStepAction(stepId, target, index);
    if (!result.ok) {
      setLocal(steps);
      setError(result.error);
      return;
    }
    // revalidatePath marks the server cache stale; it does not re-render a
    // client component already on screen. This reconciles the optimistic
    // version with what actually got written, and by now the card has been
    // in its new column for a while.
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
    setBusy(true);
    setError("");

    /*
     * Pressing play is the answer.
     *
     * The button was hidden on any project whose tracker had not been switched
     * on, which is most of them, and startTimerAction refused for the same
     * reason. So a board full of tasks had no way to record time against any
     * of them until you found a setting on another part of the page and turned
     * it on. Pressing play on a task says clearly enough that you want the
     * hours recorded, so this turns the project on and starts the clock.
     *
     * RECORD, the mildest of the modes: it keeps the hours and does nothing
     * else with them. Learning from them or billing from them are separate
     * decisions and stay where they were.
     */
    if (!canTrack) {
      const setup = await setProjectTimeModeAction({ projectId, mode: "RECORD" });
      if (!setup.ok) {
        setError(setup.error);
        setBusy(false);
        return;
      }
    }

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

  const carried = dragging ? local.find((step) => step.id === dragging) ?? null : null;

  /*
   * The carried card is rendered onto the body, not into the board.
   *
   * `position: fixed` is resolved against the nearest ancestor with a
   * transform, filter or perspective rather than against the viewport, and
   * this app now has several: the page transition animates a transform, cards
   * lift, controls translate on hover. So a card positioned at the pointer's
   * viewport coordinates was drawn at those coordinates inside whichever
   * ancestor happened to be transformed, which put it most of a page away
   * from the cursor.
   *
   * A portal to the body has no such ancestor by construction. It is also the
   * ordinary answer for anything that has to sit above the whole page, and I
   * should have reached for it before reasoning about which ancestor was at
   * fault.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const progress = boardProgress(local);

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
      {/* Stretch, so the three columns are one block rather than three
          stubs of whatever height their contents happened to be. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
        {COLUMNS.map((column) => {
          const cards = columnSteps(local, column);
          return (
            <section
              key={column}
              ref={(node) => {
                columnRefs.current[column] = node;
              }}
              className={`rounded-2xl border p-3 min-h-[120px] transition-colors ${TINT[column]} ${
                over === column && dragging
                  ? // Ringed rather than merely bordered: a one pixel colour
                    // change on a card-sized target is not an answer to
                    // "will it land here".
                    "border-violet ring-2 ring-violet/25"
                  : "border-line"
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
                {cards.map((card) => (
                  <li
                    key={card.id}
                    onPointerDown={(e) => {
                      // Only a primary press, and never from a control inside
                      // the card: pressing the play button or the name should
                      // do what it says rather than start a drag.
                      if (busy || e.button !== 0) return;
                      if ((e.target as HTMLElement).closest("button,input,select")) return;
                      const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      setDragging(card.id);
                      setCarry({ x: e.clientX, y: e.clientY, width: box.width });
                    }}
                    onPointerMove={(e) => {
                      if (dragging !== card.id) return;
                      setCarry((current) =>
                        current ? { ...current, x: e.clientX, y: e.clientY } : current
                      );
                      setOver(columnAt(columnRefs.current, e.clientX, e.clientY));
                    }}
                    onPointerUp={() => {
                      if (dragging !== card.id) return;
                      const target = over;
                      setDragging(null);
                      setCarry(null);
                      setOver(null);
                      // A press that never left the card is a press, not a
                      // drag, so it should not move anything.
                      if (target && target !== column) {
                        void move(card.id, target, columnSteps(local, target).length);
                      }
                    }}
                    onPointerCancel={() => {
                      setDragging(null);
                      setCarry(null);
                      setOver(null);
                    }}
                    style={{ touchAction: dragging === card.id ? "none" : "manipulation" }}
                    className={`rounded-xl border p-2.5 cursor-grab active:cursor-grabbing transition-shadow select-none ${
                      dragging === card.id
                        ? // The space it came from, kept open and empty so the
                          // column does not collapse under the card and shift
                          // everything else while it is being moved.
                          "border-dashed border-line bg-paper opacity-60"
                        : "bg-white border-line hover:shadow-panel"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical
                        size={13}
                        className="text-text-muted shrink-0 mt-0.5"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 break-words">
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
                      </div>

                      {/* Against the card rather than the project, so the
                          hours can answer which task ate the afternoon. On
                          every card except a finished one: a clock on work
                          that is done is an invitation to a mistake.

                          On the right and big enough to be the thing you aim
                          at. It was a 22px dot wedged between the grip and the
                          name, which is a hard target on a phone and reads as
                          a decoration rather than the one action a card has. */}
                      {!card.done && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleTimer(card)}
                          aria-label={runningStepId === card.id ? t.track.stop : t.track.timeStart}
                          className={`shrink-0 self-center w-9 h-9 rounded-full flex items-center justify-center border-none cursor-pointer press disabled:opacity-60 ${
                            runningStepId === card.id
                              ? "bg-ink text-white"
                              : "bg-coral text-white"
                          }`}
                        >
                          {runningStepId === card.id ? (
                            <Square size={13} fill="currentColor" />
                          ) : (
                            <Play size={13} fill="currentColor" className="ml-[1px]" />
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                ))}

                {/* Where it will land. Drawn at the end because that is
                    where a dropped card goes. */}
                {over === column && carried && columnOf(carried) !== column && (
                  <li
                    aria-hidden
                    className="h-[52px] rounded-xl border border-dashed border-violet/50 bg-violet-tint"
                  />
                )}

                {cards.length === 0 && !dragging && (
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
                            className="text-meta font-semibold text-link bg-none border-none cursor-pointer p-0 tap disabled:opacity-60"
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

      {/* The card in transit, on the body. Out of the way of hit testing, so
          it cannot become the thing the pointer is over. */}
      {mounted &&
        carried &&
        carry &&
        createPortal(
          <div
            className="fixed left-0 top-0 z-50 pointer-events-none rounded-xl border border-line bg-white p-2.5 dragging"
            style={{
              /*
               * Just below and right of the cursor, positioned from the
               * pointer alone.
               *
               * Carrying it from the exact point it was grabbed is the nicer
               * behaviour and it kept landing somewhere other than under the
               * cursor. Rather than keep guessing which measurement was
               * stale, this uses the one number that cannot be: where the
               * pointer is now.
               *
               * translate rather than left and top, so moving it runs on the
               * compositor instead of laying out the page on every move.
               */
              transform: `translate3d(${carry.x + 14}px, ${carry.y + 14}px, 0)`,
              width: carry.width,
            }}
          >
            <div className="font-body font-semibold text-small text-ink text-pretty">
              {carried.name}
            </div>
            <span
              className={`inline-block rounded-full px-2 py-0.5 mt-1.5 text-caption font-semibold ${
                tagClass.get(carried.deliverableId) ?? TAGS[0]
              }`}
            >
              {names.get(carried.deliverableId) ?? ""}
            </span>
          </div>,
          document.body
        )}
    </div>
  );
}
