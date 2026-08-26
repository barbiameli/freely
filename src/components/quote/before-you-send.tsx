"use client";

import { useState, useTransition } from "react";
import { Check, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/label";
import { clearQuestionAction } from "@/actions/briefs";
import { useT } from "@/lib/i18n/context";

/**
 * The questions the AI raised, as a list you can finish.
 *
 * These were a dashed-bordered block sitting inline among the sections that do
 * go to the client, which is a weak signal for "this one is invisible to them"
 * and puts your private notes inside their document. They were also read-only,
 * so a list of five where you had dealt with three looked exactly like a list
 * of five where you had dealt with none.
 *
 * So they come out of the document and sit before it, ticked off one at a time
 * and remembered. That gives the page a shape: here is what to check, here is
 * the quote, here is Publish.
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
  const [, startTransition] = useTransition();

  if (questions.length === 0) return null;

  const open = questions.filter((q) => !cleared.includes(q)).length;

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
    <Card tone={open > 0 ? "loud" : "plain"}>
      <CardHeader
        title={
          <span className="flex items-center gap-1.5">
            <Lightbulb size={13} className="text-violet" />
            {t.brief.beforeYouSend}
          </span>
        }
        hint={
          open > 0
            ? t.brief.beforeYouSendOpen.replace("{count}", String(open))
            : t.brief.beforeYouSendDone
        }
      />

      <ul className="list-none p-0 m-0 flex flex-col">
        {questions.map((question) => {
          const done = cleared.includes(question);
          return (
            <li key={question} className="border-b border-line/70 last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(question)}
                aria-pressed={done}
                className="w-full flex items-start gap-2.5 text-left bg-none border-none cursor-pointer p-0 py-2.5 tap-row"
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
    </Card>
  );
}
