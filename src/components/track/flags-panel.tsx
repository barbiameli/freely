"use client";

import { resolveFlagAction } from "@/actions/track";
import { useAction } from "@/lib/use-action";
import { ActionError } from "@/components/ui/action-error";
import type { DeliverableView, FlagView } from "@/components/track/deliverable-item";

const KIND_LABEL: Record<FlagView["kind"], string> = {
  BLOCKER: "Blocking",
  ASSUMPTION: "Assumption",
  WORTH_ASKING: "Worth asking",
};

const KIND_STYLE: Record<FlagView["kind"], string> = {
  BLOCKER: "text-overdue",
  ASSUMPTION: "text-coral",
  WORTH_ASKING: "text-text-muted",
};

/**
 * Questions worth raising about the deliverable in hand.
 *
 * Scoped to one deliverable rather than the whole project on purpose: a
 * project-wide list of twenty questions is a document nobody opens, while
 * three questions about the thing you are working on this week is something
 * you actually send. The panel follows whichever deliverable is open.
 */
export function FlagsPanel({ deliverable }: { deliverable: DeliverableView | null }) {
  const { run, pending, error } = useAction();

  if (!deliverable) {
    return (
      <div>
        <div className="font-body font-semibold text-[13px] text-ink mb-1.5">Worth flagging</div>
        <p className="text-[12.5px] text-text-muted m-0">
          Open a deliverable to see what is worth raising with the client about it.
        </p>
      </div>
    );
  }

  const open = deliverable.flags.filter((f) => !f.resolved);
  const answered = deliverable.flags.filter((f) => f.resolved);

  return (
    <div>
      <div className="font-body font-semibold text-[13px] text-ink">Worth flagging</div>
      <p className="text-[11.5px] text-text-muted mt-0.5 mb-3 truncate">{deliverable.name}</p>

      {deliverable.flags.length === 0 ? (
        <p className="text-[12.5px] text-text-muted m-0">
          {deliverable.brokenDown
            ? "Nothing to raise on this one."
            : "Break this deliverable down and anything worth asking will show up here."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {open.map((flag) => (
            <div key={flag.id} className="bg-paper rounded-lg px-3 py-2.5">
              <div className={`text-[10.5px] font-bold uppercase tracking-wide ${KIND_STYLE[flag.kind]}`}>
                {KIND_LABEL[flag.kind]}
              </div>
              <div className="text-[13px] text-ink leading-snug mt-1">{flag.question}</div>
              {flag.reason && (
                <div className="text-[11.5px] text-text-muted leading-snug mt-1">{flag.reason}</div>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => resolveFlagAction(flag.id, true))}
                className="text-[11.5px] font-semibold text-violet bg-none border-none cursor-pointer p-0 mt-2 disabled:opacity-50"
              >
                Mark answered
              </button>
            </div>
          ))}

          {answered.length > 0 && (
            <div>
              <div className="text-[11px] text-text-muted mb-1.5">
                Answered ({answered.length})
              </div>
              {answered.map((flag) => (
                <div key={flag.id} className="flex items-start gap-2 py-1">
                  <span className="text-[12px] text-text-muted line-through flex-1 leading-snug">
                    {flag.question}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => resolveFlagAction(flag.id, false))}
                    className="text-[11px] text-violet bg-none border-none cursor-pointer p-0 shrink-0 disabled:opacity-50"
                  >
                    Reopen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <ActionError error={error} className="mt-2" />
    </div>
  );
}
