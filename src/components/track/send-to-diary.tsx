"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Check } from "lucide-react";
import { addDiaryEntryAction } from "@/actions/diary";
import { useAction } from "@/lib/use-action";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
    if (result.ok) {
      setOpen(false);
      router.push(`/track/${projectId}?view=client`);
    }
  }

  return (
    <>
      <Button variant="ghost" icon={Send} onClick={start} data-guide="client">
        {t.track.sendToDiary}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.track.shareTitle}
        hint={t.track.shareHint}
        wide
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button size="sm" icon={Check} disabled={pending || !ready} onClick={send}>
              {pending ? t.common.saving : t.track.shareSend}
            </Button>
          </>
        }
      >
        <div className="-mx-1">
          <div className="max-h-[50vh] overflow-y-auto px-1">
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
          <div className="mt-4">
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
        </div>
      </Modal>
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
