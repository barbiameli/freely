"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X, Check } from "lucide-react";
import { addDiaryEntryAction } from "@/actions/diary";
import { useAction } from "@/lib/use-action";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { SubLabel } from "@/components/ui/label";
import {
  shareableItems,
  composeUpdate,
  hasAnythingToSend,
  type ShareItem,
  type ShareKind,
  type UpdateSource,
} from "@/lib/diary-update";
import { useT } from "@/lib/i18n/context";
import type { Dictionary } from "@/lib/i18n";

/**
 * "Send to Diary", after asking what goes in it.
 *
 * It used to write one line and send it: "2 of 4 deliverables complete so far.
 * Status: ACTIVE." Nothing you had ticked appeared in it, so it looked broken
 * while doing exactly what it was written to do, and it put an internal status
 * enum in front of a paying client.
 *
 * So it asks. Everything shareable is listed and everything is on except the
 * questions, which are notes to yourself in tracker wording. This is the one
 * place in the app where a wrong default is published, and the cost of a
 * confirmation step is a click.
 *
 * The preview is the whole point of the dialog. Ticking boxes and hoping is what
 * the last version effectively was; reading the paragraph before it goes is what
 * makes it safe to press.
 */
export function SendToDiary({
  projectId,
  source,
}: {
  projectId: string;
  source: UpdateSource;
}) {
  const t = useT();
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ShareItem[]>([]);

  function start() {
    setItems(shareableItems(source));
    setOpen(true);
  }

  function toggle(id: string) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, on: !i.on } : i)));
  }

  const composed = composeUpdate(items, source, words(t));
  const ready = hasAnythingToSend(items);

  async function send() {
    const result = await run(
      () => addDiaryEntryAction(projectId, composed.title, composed.body),
      { skipRefresh: true }
    );
    if (result) {
      setOpen(false);
      router.push(`/diary/${projectId}`);
    }
  }

  return (
    <>
      <Button variant="ghost" icon={Send} onClick={start}>
        {t.track.sendToDiary}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={t.track.shareTitle}
        >
          <div className="bg-white rounded-card shadow-panel w-full max-w-[560px] my-auto">
            <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
              <div className="min-w-0">
                <div className="font-body font-bold text-body text-ink">{t.track.shareTitle}</div>
                <p className="text-caption text-slate mt-0.5 mb-0">{t.track.shareHint}</p>
              </div>
              <button
                type="button"
                aria-label={t.common.close}
                onClick={() => setOpen(false)}
                className="shrink-0 text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 tap"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
              {/* Grouped, because "untick the ones you do not want" is only easy
                  when like things sit together. */}
              {(["PROGRESS", "DONE", "TODO", "DUE", "QUESTION"] as ShareKind[]).map((kind) => {
                const group = items.filter((i) => i.kind === kind);
                if (group.length === 0) return null;
                return (
                  <div key={kind} className="mb-4 last:mb-0">
                    <SubLabel className="mb-1.5">{groupLabel(kind, t)}</SubLabel>
                    <div className="flex flex-col">
                      {group.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-start gap-2.5 py-1.5 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={item.on}
                            onChange={() => toggle(item.id)}
                            className="mt-[3px] accent-violet shrink-0"
                          />
                          <span
                            className={`text-small leading-snug ${
                              item.on ? "text-ink" : "text-text-muted line-through"
                            }`}
                          >
                            {item.kind === "PROGRESS" ? progressLine(items, t) : item.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* What the client will actually read. Ticking boxes and hoping is
                what the old version effectively was. */}
            <div className="px-5 pb-4">
              <SubLabel className="mb-1.5">{t.track.sharePreview}</SubLabel>
              <div className="bg-paper border border-line rounded-lg px-3.5 py-3">
                {ready ? (
                  <p className="text-small text-slate leading-[1.6] whitespace-pre-line m-0">
                    {composed.body}
                  </p>
                ) : (
                  <p className="text-small text-text-muted m-0">{t.track.shareNothing}</p>
                )}
              </div>
              <ActionError error={error} className="mt-2" />
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-line">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-meta text-slate hover:text-ink bg-none border-none cursor-pointer p-0 tap"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={pending || !ready}
                onClick={send}
                className="flex items-center gap-1.5 font-body font-bold text-meta text-white bg-violet rounded-lg px-3.5 py-2 border-none cursor-pointer disabled:opacity-50"
              >
                <Check size={13} />
                {pending ? t.common.saving : t.track.shareSend}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The progress line, counted over what is still ticked so it agrees with the
 * names underneath it. */
function progressLine(items: ShareItem[], t: Dictionary): string {
  const done = items.filter((i) => i.kind === "DONE" && i.on).length;
  const todo = items.filter((i) => i.kind === "TODO" && i.on).length;
  return t.track.doneOf.replace("{done}", String(done)).replace("{total}", String(done + todo));
}

function groupLabel(kind: ShareKind, t: Dictionary): string {
  switch (kind) {
    case "PROGRESS":
      return t.track.shareProgress;
    case "DONE":
      return t.track.shareDone;
    case "TODO":
      return t.track.shareTodo;
    case "DUE":
      return t.track.shareDue;
    case "QUESTION":
      return t.track.shareQuestions;
  }
}

function words(t: Dictionary) {
  return {
    progress: t.track.doneOf,
    finished: t.track.shareFinishedLead,
    stillToCome: t.track.shareTodoLead,
    questionsForYou: t.track.shareQuestionsLead,
    due: t.track.shareDueLead,
    title: t.track.shareEntryTitle,
  };
}
