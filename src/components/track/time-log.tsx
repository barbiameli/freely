"use client";

import { useState } from "react";
import { Play, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { sayDuration, secondsOf } from "@/lib/time-tracking";
import type { WeekEntry } from "@/lib/time-week";
import { useRouter } from "next/navigation";
import { continueTimerAction, deleteTimeAction, logTimeAction } from "@/actions/time";
import { announceTimerChange } from "@/components/track/timer-bar";

/**
 * What each stretch of time was actually spent on.
 *
 * The durations on their own are a receipt: they say Tuesday had six hours in
 * it and nothing about what those hours bought. The line against each one is
 * the part somebody needs when a client asks where the week went, or when they
 * are working out why a job ran over.
 *
 * Two ways to fill it, because the honest answer is usually already on screen:
 * pick the deliverable being worked on, or type what happened. Picking writes
 * the name into the note as well, so the log reads as sentences rather than as
 * a column of foreign keys.
 */
export function TimeLog({
  entries,
  deliverables,
}: {
  entries: WeekEntry[];
  deliverables: { id: string; name: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.map((entry) => [entry.id, entry.note]))
  );
  const [saving, setSaving] = useState("");
  const [busy, setBusy] = useState("");

  async function again(entry: WeekEntry) {
    setBusy(entry.id);
    const result = await continueTimerAction(entry.id);
    setBusy("");
    if (!result.ok) return;
    announceTimerChange({
      id: result.data.id,
      projectId: "",
      projectTitle: "",
      note: entry.note,
      startedAt: new Date().toISOString(),
    });
    router.refresh();
  }

  async function save(entry: WeekEntry, patch: { note?: string; deliverableId?: string | null }) {
    setSaving(entry.id);
    await logTimeAction({ entryId: entry.id, ...patch });
    setSaving("");
  }

  return (
    <ul className="list-none p-0 m-0 flex flex-col">
      {entries.map((entry) => (
        <li key={entry.id} className="border-b border-line/70 last:border-b-0 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-body font-semibold text-small text-ink tabular-nums shrink-0">
              {sayDuration(secondsOf(entry))}
            </span>
            <span className="text-caption text-text-muted">
              {new Date(entry.startedAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {/* The commonest thing anybody wants from a list of past work:
                the same task again, without retyping what it was. Retyping is
                where descriptions get shorter each time until they stop being
                written. */}
            <button
              type="button"
              disabled={busy === entry.id}
              onClick={() => void again(entry)}
              aria-label={t.track.timeContinue}
              title={t.track.timeContinue}
              className="ml-auto p-1 rounded text-text-muted hover:text-violet border-none bg-none cursor-pointer tap disabled:opacity-50"
            >
              <Play size={13} />
            </button>
            <button
              type="button"
              onClick={() => void deleteTimeAction(entry.id)}
              aria-label={t.track.timeDelete}
              className="p-1 rounded text-text-muted hover:text-overdue border-none bg-none cursor-pointer tap"
            >
              <Trash2 size={13} />
            </button>
          </div>

          <input
            type="text"
            value={notes[entry.id] ?? ""}
            onChange={(e) => setNotes((all) => ({ ...all, [entry.id]: e.target.value }))}
            onBlur={() => void save(entry, { note: notes[entry.id] ?? "" })}
            placeholder={t.track.logPlaceholder}
            className="w-full mt-1.5 bg-paper rounded-lg border-none px-3 py-2 text-sm text-ink outline-none"
          />

          {/* The answer is usually already on the project. Picking one writes
              its name into the line as well, so the log reads as sentences
              rather than as a column of references. */}
          {deliverables.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {deliverables.slice(0, 6).map((deliverable) => (
                <button
                  key={deliverable.id}
                  type="button"
                  disabled={saving === entry.id}
                  onClick={() => {
                    setNotes((all) => ({ ...all, [entry.id]: deliverable.name }));
                    void save(entry, {
                      note: deliverable.name,
                      deliverableId: deliverable.id,
                    });
                  }}
                  className={`text-caption rounded-full px-2.5 py-1 border cursor-pointer tap ${
                    entry.deliverableId === deliverable.id
                      ? "bg-violet-tint border-violet text-violet font-semibold"
                      : "bg-white border-line text-slate"
                  }`}
                >
                  {deliverable.name}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
