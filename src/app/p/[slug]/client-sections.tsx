"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { ClientDeliverable } from "@/lib/client-page";
import { hasDetail } from "@/lib/client-page";
import { fill } from "@/lib/i18n";

/**
 * One deliverable, with its steps folded away underneath.
 *
 * Closed by default. A client opening this page wants to know whether the thing
 * they are paying for is done, and eleven sub-tasks under each of six
 * deliverables answers a question they did not ask while burying the one they
 * did. The detail is there for the client who wants it, one click away, and
 * invisible to the one who does not.
 *
 * The row is only pressable when there is something to open. A chevron that
 * does nothing is worse than no chevron, and plenty of deliverables were never
 * broken down.
 */
export function ClientDeliverableRow({
  deliverable,
  label,
  primary,
  stepsLabel,
}: {
  deliverable: ClientDeliverable;
  /** The name to show, which may be the client-facing rewrite. */
  label: string;
  primary: string;
  /** "{done} of {total} steps", already localised. */
  stepsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const detail = hasDetail(deliverable);
  const doneSteps = deliverable.steps.filter((s) => s.done).length;

  const row = (
    <>
      <span
        className="mt-[3px] w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[10px] text-white"
        style={{ backgroundColor: deliverable.done ? primary : "#E8EAEF" }}
      >
        {deliverable.done ? "✓" : ""}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-small leading-relaxed ${
            deliverable.done ? "text-text-muted line-through" : "text-slate"
          }`}
        >
          {label}
        </span>
        {detail && (
          <span className="block text-caption text-text-muted mt-0.5 tabular-nums">
            {fill(stepsLabel, { done: doneSteps, total: deliverable.steps.length })}
          </span>
        )}
      </span>

      {detail &&
        (open ? (
          <ChevronDown size={14} className="text-text-muted shrink-0 mt-1" />
        ) : (
          <ChevronRight size={14} className="text-text-muted shrink-0 mt-1" />
        ))}
    </>
  );

  return (
    <li className="border-b border-line/60 last:border-b-0">
      {detail ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="w-full flex items-start gap-2.5 text-left bg-none border-none cursor-pointer p-0 py-2.5 tap-row"
        >
          {row}
        </button>
      ) : (
        <div className="flex items-start gap-2.5 py-2.5">{row}</div>
      )}

      {detail && open && (
        <ul className="list-none p-0 m-0 pl-6 pb-3 flex flex-col gap-1.5">
          {deliverable.steps.map((s) => (
            <li key={s.id} className="flex items-start gap-2">
              <span
                className="mt-[6px] w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: s.done ? primary : "#E8EAEF" }}
              />
              <span
                className={`text-caption leading-relaxed ${
                  s.done ? "text-text-muted line-through" : "text-slate"
                }`}
              >
                {s.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
