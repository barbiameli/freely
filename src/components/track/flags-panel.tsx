"use client";

import { resolveFlagAction } from "@/actions/track";
import { useAction } from "@/lib/use-action";
import { ActionError } from "@/components/ui/action-error";
import type { DeliverableView, FlagView } from "@/components/track/deliverable-item";
import { useT } from "@/lib/i18n/context";
import { SubLabel } from "@/components/ui/label";

/**
 * Things worth raising about this deliverable.
 *
 * The first version put a card on every deliverable with a question, a
 * paragraph of reasoning and an action, which turned a sidebar into an essay
 * and taught you to ignore it. The model is now told zero is the normal answer
 * and only real risks count, and this shows them plainly: the question, one
 * clause of why, nothing else. No panel at all when there is nothing, since an
 * empty section still costs attention.
 *
 * It lives inside the deliverable now rather than in a rail. In the rail it was
 * a 270px column of eight-word lines that needed its own subtitle to say which
 * deliverable it was even about, and it changed under you as you opened
 * different rows. Sitting at the foot of the open one it needs no subtitle, and
 * a question about a piece of work is next to that piece of work.
 */
const KIND_KEY: Record<FlagView["kind"], "needsAnAnswer" | "assuming" | "worthAsking"> = {
  BLOCKER: "needsAnAnswer",
  ASSUMPTION: "assuming",
  WORTH_ASKING: "worthAsking",
};

export function FlagsPanel({ deliverable }: { deliverable: DeliverableView | null }) {
  const t = useT();
  const { run, pending, error } = useAction();

  const open = deliverable?.flags.filter((f) => !f.resolved) ?? [];
  const answered = deliverable?.flags.filter((f) => f.resolved) ?? [];

  // Nothing to raise is the common case and needs no space.
  if (!deliverable || (open.length === 0 && answered.length === 0)) return null;

  return (
    <div className="bg-paper border border-line rounded-lg px-4 py-3.5 mt-4 max-w-[74ch]">
      <SubLabel className="mb-3">
        {t.track.worthRaising}
      </SubLabel>

      {open.length === 0 ? (
        <p className="text-small text-text-muted m-0">{t.track.allAnswered}</p>
      ) : (
        // Two across on a wide screen. One question per full-width row would put
        // a six-word question on a line built for eighteen. content-start so a
        // short question does not stretch to match a long one beside it.
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 content-start">
          {open.map((flag) => (
            <div
              key={flag.id}
              className={`pl-3 border-l-2 ${
                flag.kind === "BLOCKER" ? "border-overdue" : "border-line"
              }`}
            >
              <div
                className={`text-caption font-bold uppercase tracking-wide ${
                  flag.kind === "BLOCKER" ? "text-overdue" : "text-text-muted"
                }`}
              >
                {t.track[KIND_KEY[flag.kind]]}
              </div>
              <div className="font-body font-semibold text-small text-ink leading-snug mt-1">
                {flag.question}
              </div>
              {flag.reason && (
                <div className="text-caption text-text-muted leading-snug mt-1">{flag.reason}</div>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => resolveFlagAction(flag.id, true))}
                className="text-caption font-semibold text-violet bg-none border-none cursor-pointer p-0 tap mt-1.5 disabled:opacity-50"
              >
                {t.track.answered}
              </button>
            </div>
          ))}
        </div>
      )}

      {answered.length > 0 && (
        <details className="mt-3">
          <summary className="text-caption text-text-muted cursor-pointer">
            {answered.length} {t.track.answered.toLowerCase()}
          </summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {answered.map((flag) => (
              <div key={flag.id} className="flex items-start gap-2">
                <span className="text-caption text-text-muted line-through flex-1 leading-snug">
                  {flag.question}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => resolveFlagAction(flag.id, false))}
                  className="text-caption text-violet bg-none border-none cursor-pointer p-0 tap shrink-0"
                >
                  {t.track.reopen}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      <ActionError error={error} className="mt-2" />
    </div>
  );
}
