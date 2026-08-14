"use client";

import { useEffect, useState } from "react";
import { Check, X, BookOpen } from "lucide-react";
import { addDiaryEntryAction } from "@/actions/diary";
import { useAction } from "@/lib/use-action";
import { ActionError } from "@/components/ui/action-error";
import { useT } from "@/lib/i18n/context";

/** One thing ticked off, and which deliverable it belongs to. */
export interface DoneItem {
  /** What was ticked. A step name, or a deliverable name when the whole thing
   * was ticked at once. */
  name: string;
  /** The deliverable it sits under, used as the entry's title when everything
   * ticked came from the same one. */
  deliverable: string;
}

/**
 * "Send this to the diary?", after ticking things off.
 *
 * The diary is the client-facing side of a tracked project and it was the one
 * part nobody kept up, for an ordinary reason: writing an update is a separate
 * task you remember at the wrong time. But the moment you tick something off is
 * exactly when you know what happened and can still describe it, so that is
 * when it asks.
 *
 * It drafts the entry rather than opening a blank box. What was ticked is
 * already a list of what got done, so the work is editing a sentence rather
 * than remembering a week.
 *
 * Editable before it goes, because these are notes to yourself in the tracker's
 * words and the client reads them. "Scan every component frame for text layers
 * still on Inter" is a task; a client wants to know the font swap is done.
 *
 * Appears once things are actually ticked and stays until answered, so a run of
 * five ticks is one prompt rather than five.
 */
export function DiaryPrompt({
  projectId,
  done,
  onDismiss,
}: {
  projectId: string;
  done: DoneItem[];
  onDismiss: () => void;
}) {
  const t = useT();
  const { run, pending, error } = useAction();
  const [body, setBody] = useState("");
  const [added, setAdded] = useState(false);
  const [edited, setEdited] = useState(false);

  // Redrafted as more gets ticked, until it is typed into. After that it is
  // theirs, and overwriting somebody's sentence because they ticked one more
  // box would be the worst possible moment to lose it.
  useEffect(() => {
    if (edited) return;
    setBody(done.map((item) => item.name).join("\n"));
  }, [done, edited]);

  if (done.length === 0 || added) return null;

  // One deliverable's worth of ticks is about that deliverable, so it says so.
  // A mix is just progress.
  // Array.from rather than a spread: the TypeScript target here turns an
  // iterator spread into TS2802.
  const names = Array.from(new Set(done.map((item) => item.deliverable)));
  const title = names.length === 1 ? names[0] : t.track.diaryDefaultTitle;

  return (
    <div className="rounded-card border border-violet/30 bg-violet-tint px-4 py-3.5 mt-4 animate-card-in motion-reduce:animate-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-body font-bold text-small text-ink">
            <BookOpen size={13} className="text-violet shrink-0" />
            {t.track.diaryPromptTitle.replace("{count}", String(done.length))}
          </div>
          <p className="text-caption text-slate mt-0.5 mb-0">{t.track.diaryPromptHint}</p>
        </div>
        <button
          type="button"
          aria-label={t.common.close}
          onClick={onDismiss}
          className="shrink-0 text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 tap"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-2.5 text-caption text-text-muted">{title}</div>
      <textarea
        value={body}
        onChange={(e) => {
          setEdited(true);
          setBody(e.target.value);
        }}
        rows={Math.min(8, Math.max(2, body.split("\n").length))}
        className="w-full font-body text-small text-ink leading-[1.6] bg-white border border-line rounded-lg px-3 py-2.5 mt-1 outline-none focus:border-violet"
      />

      <div className="flex flex-wrap items-center gap-3 mt-2.5">
        <button
          type="button"
          disabled={pending || !body.trim()}
          onClick={async () => {
            const result = await run(() => addDiaryEntryAction(projectId, title, body));
            if (result.ok) {
              setAdded(true);
              onDismiss();
            }
          }}
          className="flex items-center gap-1.5 font-body font-bold text-meta text-white bg-violet rounded-lg px-3.5 py-2 border-none cursor-pointer disabled:opacity-50"
        >
          <Check size={13} />
          {pending ? t.common.saving : t.track.diaryAdd}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-meta text-slate hover:text-ink bg-none border-none cursor-pointer p-0 tap"
        >
          {t.track.diaryNotNow}
        </button>
      </div>

      <ActionError error={error} className="mt-2" />
    </div>
  );
}
