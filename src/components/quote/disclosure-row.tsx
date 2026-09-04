"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import clsx from "@/lib/clsx";

/**
 * One line of a form, closed until it is wanted.
 *
 * The wizard grew by accumulation: a bordered card for the brief, another for
 * visual references, another for the setup, each with its own heading style
 * and its own idea of how much room it deserved. Folding them into one card
 * made the page shorter and the hierarchy worse, because five sections with no
 * ranking between them is a list of equals, and only one of them is the thing
 * somebody came to do.
 *
 * So everything that is not the brief is a row: its name on the left, its
 * current answer on the right, and the controls only when you open it. A row
 * costs one line whether it holds a text field or four chips, which is what
 * puts the Generate button back above the fold.
 *
 * The answer on the right is the part that makes this work rather than hide
 * things. A closed row that says "All on delivery" has been answered in
 * public; a closed row that says nothing is a drawer somebody has to open to
 * find out what is in it.
 */
export function DisclosureRow({
  label,
  value,
  answered = true,
  open,
  onToggle,
  badge,
  tone,
  children,
}: {
  label: string;
  /** The current answer, shown while closed. */
  value: string;
  /**
   * Whether that answer is a decision or a prompt.
   *
   * An unanswered row is violet and reads as something to do; an answered one
   * is ink and reads as a fact. Same slot, so the eye can run down the column
   * and see what is left.
   */
  answered?: boolean;
  open: boolean;
  onToggle: () => void;
  /** A short marker beside the label, for "needed" or "changed". */
  badge?: ReactNode;
  /** Highlighted when something is missing from this row. */
  tone?: "problem";
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "border-t border-line transition-colors",
        // A tone rather than another rule. Hairlines alone gave every row the
        // same weight whether it was open or shut, so an expanded panel read
        // as loose controls between two lines instead of as one block.
        open && "bg-paper",
        tone === "problem" && "bg-overdue-tint"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left bg-none border-none cursor-pointer px-5 py-4 hover:bg-paper transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0 shrink-0">
          {/* The open row is the heading of what is below it, so it is
              weighted like one. Closed rows stay quiet: five bold labels in a
              column is a list with no hierarchy at all. */}
          <span
            className={
              open ? "font-body font-bold text-body text-ink" : "font-body text-small text-slate"
            }
          >
            {label}
          </span>
          {badge}
        </span>
        <span className="flex items-center gap-2 min-w-0">
          <span
            className={clsx(
              "font-body font-semibold text-small text-right truncate",
              answered ? "text-ink" : "text-violet"
            )}
          >
            {value}
          </span>
          {open ? (
            <ChevronDown size={14} className="text-text-muted shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-text-muted shrink-0" />
          )}
        </span>
      </button>

      {open && <div className="px-5 pb-6">{children}</div>}
    </div>
  );
}
