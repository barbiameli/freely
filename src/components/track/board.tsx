"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { ActionError } from "@/components/ui/action-error";
import { moveStepAction } from "@/actions/board";
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
}: {
  steps: BoardStep[];
  /** Names for the tag on each card, keyed by deliverable id. */
  deliverables: { id: string; name: string }[];
}) {
  const t = useT();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Column | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    if (!result.ok) setError(result.error);
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
                    onDragStart={() => setDragging(card.id)}
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
                    className={`bg-white rounded-xl border border-line p-2.5 cursor-grab active:cursor-grabbing ${
                      dragging === card.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical
                        size={13}
                        className="text-text-muted shrink-0 mt-0.5"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          className={`font-body font-semibold text-small text-pretty ${
                            card.done ? "text-slate line-through" : "text-ink"
                          }`}
                        >
                          {card.name}
                        </div>
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
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
