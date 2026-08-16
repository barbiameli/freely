"use client";

import type { ReactNode } from "react";
import clsx from "@/lib/clsx";

/**
 * The app offering the person something, at one of two volumes.
 *
 * There were four of these and they looked like three different things: the
 * diary prompt and the landed prompt tinted violet, the signed banner white
 * with a violet edge, the breakdown offer plain white with a grey edge. All
 * four say the same kind of thing, which is "here is something you could do
 * next", so looking different was noise that made the loud ones look arbitrary.
 *
 * Two levels, and the difference is whether it is about money:
 *
 * `attention` is tinted, for something with a consequence if ignored. A quote
 * you signed and never tracked is unbilled work.
 *
 * `quiet` is white, for a genuine offer. Breaking deliverables into steps is
 * useful and nothing goes wrong if it never happens.
 *
 * Actions always sit on the right on a wide screen and underneath on a narrow
 * one, in the same order every time: the way out, then the thing to do. A
 * prompt whose buttons move around is one somebody has to read twice.
 */
export function Prompt({
  level = "quiet",
  title,
  body,
  actions,
  children,
  className,
}: {
  level?: "quiet" | "attention";
  title: ReactNode;
  body?: ReactNode;
  /** Buttons, quietest first. */
  actions?: ReactNode;
  /** Anything that opens up underneath, like a form. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-card px-4 py-3.5 sm:px-5 animate-card-in motion-reduce:animate-none",
        level === "attention"
          ? "border border-violet/30 bg-violet-tint"
          : "border border-line bg-white",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-body font-semibold text-small text-ink text-pretty">{title}</div>
          {body && <p className="text-meta text-text-muted mt-1 mb-0 text-pretty">{body}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">{actions}</div>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
