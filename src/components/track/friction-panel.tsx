"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { shortName, type Friction } from "@/lib/project-health";

/**
 * What needs attention, collapsed.
 *
 * The first version printed each issue as a title and one long sentence that
 * joined every affected deliverable with commas. Since a quote's deliverables
 * are written for a client to read, each is often a full sentence, so seven of
 * them ran to a paragraph of unreadable text sitting permanently near the top
 * of the page.
 *
 * Now: a single summary line you can open, one row per issue, and the
 * deliverables as separate items with their leading clause rather than the
 * whole description. Collapsed by default, since it is a thing to check rather
 * than a thing to read every time.
 */
const DOT: Record<Friction["severity"], string> = {
  high: "bg-overdue",
  medium: "bg-coral",
  low: "bg-line",
};

const TITLE: Record<Friction["severity"], string> = {
  high: "text-overdue",
  medium: "text-coral",
  low: "text-ink",
};

function summarise(friction: Friction[]): string {
  const high = friction.filter((f) => f.severity === "high").length;
  if (high > 0) {
    return `${high} thing${high === 1 ? "" : "s"} need${high === 1 ? "s" : ""} sorting`;
  }
  return `${friction.length} thing${friction.length === 1 ? "" : "s"} to look at`;
}

export function FrictionPanel({ friction }: { friction: Friction[] }) {
  // Something genuinely wrong is worth opening on arrival. Housekeeping is
  // not, and that is the case that produced the wall of text.
  const urgent = friction.some((f) => f.severity === "high");
  const [open, setOpen] = useState(urgent);

  if (friction.length === 0) return null;

  return (
    <div className="bg-white border border-line rounded-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2.5 w-full text-left bg-none border-none cursor-pointer px-4 py-3"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[friction[0].severity]}`} />
        <span className="font-body font-semibold text-small text-ink flex-1">
          {summarise(friction)}
        </span>
        <ChevronDown
          size={14}
          className={`text-text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3.5">
          {friction.map((f) => (
            <div key={f.title} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
              <div className={`text-small font-semibold ${TITLE[f.severity]}`}>{f.title}</div>
              {f.detail && (
                <div className="text-meta text-text-muted leading-snug mt-0.5">{f.detail}</div>
              )}
              {f.items && f.items.length > 0 && (
                <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-1">
                  {f.items.slice(0, 6).map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-text-muted shrink-0 mt-[7px]" />
                      <span className="text-small text-slate leading-snug" title={item}>
                        {shortName(item)}
                      </span>
                    </li>
                  ))}
                  {f.items.length > 6 && (
                    <li className="text-meta text-text-muted ml-3">
                      and {f.items.length - 6} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
