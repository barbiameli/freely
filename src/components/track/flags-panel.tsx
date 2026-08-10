"use client";

import { resolveFlagAction } from "@/actions/track";
import { useAction } from "@/lib/use-action";
import { ActionError } from "@/components/ui/action-error";
import { shortName } from "@/lib/project-health";
import type { DeliverableView, FlagView } from "@/components/track/deliverable-item";
import { useT } from "@/lib/i18n/context";

/**
 * Things worth raising about the deliverable in hand.
 *
 * The first version put a card on every deliverable with a question, a
 * paragraph of reasoning and an action, which turned a sidebar into an essay
 * and taught you to ignore it. The model is now told zero is the normal answer
 * and only real risks count, and this shows them plainly: the question, one
 * clause of why, nothing else. No panel at all when there is nothing, since an
 * empty section still costs attention.
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
    <div className="bg-white border border-line rounded-card p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <span className="font-body font-semibold text-small text-ink">{t.track.worthRaising}</span>
        <span className="text-caption text-text-muted truncate max-w-[45%]">
          {shortName(deliverable.name, 24)}
        </span>
      </div>

      {open.length === 0 ? (
        <p className="text-small text-text-muted m-0">{t.track.allAnswered}</p>
      ) : (
        <div className="flex flex-col gap-3.5">
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
              <div className="text-small text-ink leading-snug mt-1">{flag.question}</div>
              {flag.reason && (
                <div className="text-caption text-text-muted leading-snug mt-1">{flag.reason}</div>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => resolveFlagAction(flag.id, true))}
                className="text-caption font-semibold text-violet bg-none border-none cursor-pointer p-0 mt-1.5 disabled:opacity-50"
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
                  className="text-caption text-violet bg-none border-none cursor-pointer p-0 shrink-0"
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
