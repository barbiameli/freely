"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Lightbulb } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { clearQuestionAction } from "@/actions/briefs";
import { useT } from "@/lib/i18n/context";

/** One flag per quote, so the overlay arrives once and never again. */
function seenKey(briefId: string): string {
  return `freely.beforeYouSend.${briefId}`;
}

function alreadySeen(briefId: string): boolean {
  try {
    return window.localStorage.getItem(seenKey(briefId)) === "1";
  } catch {
    // Private browsing, or storage full. Not being able to remember is a
    // reason to stay quiet rather than to interrupt on every visit.
    return true;
  }
}

function markSeen(briefId: string): void {
  try {
    window.localStorage.setItem(seenKey(briefId), "1");
  } catch {
    // Nothing to do. Worst case it opens again next time.
  }
}

/**
 * The questions the AI raised, as a list you can finish.
 *
 * These used to hold a column of their own beside the quote, which gave five
 * private notes the same weight as the document going to the client and left
 * a wall of text where the quote should be. So they moved into an overlay.
 *
 * It opens itself once, a couple of seconds after the quote first appears,
 * because that is the moment the questions are worth reading and nobody goes
 * looking for a button they have not seen yet. After that it is a small
 * "Before you send" control carrying the count, and the list is one press away
 * whenever it is wanted.
 *
 * Dismissing is escape, the close, or the backdrop, and dismissing settles
 * nothing: the count stays until each line is actually ticked.
 *
 * Publishing is never blocked. You are the one who knows whether a question
 * matters, and half of them will be things you already had in hand. A count
 * you can ignore is honest; a gate you cannot is Freely overruling you about
 * your own quote.
 */
export function BeforeYouSend({
  briefId,
  questions,
  cleared: initialCleared,
}: {
  briefId: string;
  questions: string[];
  /** Which are already ticked, by their text. */
  cleared: string[];
}) {
  const t = useT();
  const [cleared, setCleared] = useState<string[]>(initialCleared);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const unchecked = questions.filter((q) => !cleared.includes(q)).length;
  const hasQuestions = questions.length > 0;

  useEffect(() => {
    if (!hasQuestions) return;
    // Only when something is still outstanding, and only the first time this
    // quote is opened. A checklist that reopens itself after you have been
    // through it is nagging.
    if (unchecked === 0) return;
    if (alreadySeen(briefId)) return;

    const timer = window.setTimeout(() => {
      markSeen(briefId);
      setOpen(true);
    }, 2200);
    return () => window.clearTimeout(timer);
    // Deliberately keyed on the quote alone: ticking a box mid-timer should
    // not restart the wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefId, hasQuestions]);

  if (!hasQuestions) return null;

  function toggle(question: string) {
    const next = cleared.includes(question)
      ? cleared.filter((q) => q !== question)
      : [...cleared, question];
    // Set first, save after. A tick that waits on a round trip feels broken,
    // and the worst case here is one checkbox out of step until a reload.
    setCleared(next);
    startTransition(() => {
      void clearQuestionAction(briefId, question, !cleared.includes(question));
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        // Held bright while the list is up, so the overlay reads as belonging
        // to this control rather than as something the page did on its own.
        // Above the overlay, so it stays sharp while everything behind it
        // softens and the list reads as belonging to this control. Pressing it
        // again closes, since that is what a control that looks pressed should
        // do.
        className={`relative z-[60] inline-flex items-center gap-1.5 rounded-full border transition-colors px-3 py-1.5 cursor-pointer tap-row ${
          open
            ? "border-white bg-white text-ink"
            : "border-white/25 bg-white/10 hover:bg-white/20 text-white/85"
        }`}
      >
        <Lightbulb size={13} className="shrink-0" />
        <span className="font-body font-semibold text-caption">{t.brief.beforeYouSend}</span>
        {unchecked > 0 && (
          <span className="font-body font-bold text-caption bg-coral text-white rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center shrink-0">
            {unchecked}
          </span>
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.brief.beforeYouSend}
        hint={
          unchecked > 0
            ? t.brief.beforeYouSendOpen.replace("{count}", String(unchecked))
            : t.brief.beforeYouSendDone
        }
        wide
      >
        <ul className="list-none p-0 m-0 flex flex-col">
          {questions.map((question) => {
            const done = cleared.includes(question);
            return (
              <li key={question} className="border-b border-line/70 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggle(question)}
                  aria-pressed={done}
                  className="w-full flex items-start gap-2.5 text-left bg-none border-none cursor-pointer p-0 py-3 tap-row"
                >
                  <span
                    className={`mt-[2px] w-[15px] h-[15px] rounded border shrink-0 flex items-center justify-center transition-colors ${
                      done ? "bg-violet border-violet" : "bg-white border-line"
                    }`}
                  >
                    {done && <Check size={10} strokeWidth={3.5} className="text-white" />}
                  </span>
                  <span
                    className={`text-small leading-relaxed text-pretty ${
                      done ? "text-text-muted line-through" : "text-slate"
                    }`}
                  >
                    {question}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
}
