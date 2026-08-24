"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  ROADMAP,
  outstanding,
  ofKind,
  remaining,
  type ItemKind,
  type RoadmapItem,
} from "@/lib/roadmap";

/**
 * The state of the work, on the page where the work is looked at.
 *
 * Three tabs rather than three cards, because they answer three different
 * questions and nobody has all three at once. What is left, what broke, and
 * what was decided.
 *
 * Decisions are here for the same reason the bugs are: so they stop being
 * reopened. A choice with its reason attached survives being forgotten; a
 * choice on its own gets remade differently in three weeks.
 */
type Tab = "todo" | ItemKind;

const TABS: { id: Tab; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "bug", label: "Fixed" },
  { id: "decision", label: "Decided" },
];

export function RoadmapCard() {
  const [tab, setTab] = useState<Tab>("todo");

  const items =
    tab === "todo" ? outstanding(ROADMAP) : ofKind(tab as ItemKind, ROADMAP);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Label>The work</Label>
          <p className="text-caption text-text-muted mt-1 mb-0 text-pretty">
            {remaining()} things outstanding. Kept in the repo beside the code, so it moves in the
            same commit as the thing it describes.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3.5">
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTab(option.id)}
            className={`font-body font-semibold text-caption rounded-full px-3 py-1.5 border-none cursor-pointer tap transition-colors ${
              tab === option.id
                ? "bg-violet text-white"
                : "bg-paper text-slate hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-small text-text-muted mt-4 mb-0">Nothing here.</p>
      ) : (
        <div className="flex flex-col mt-3">
          {items.map((item) => (
            <Row key={item.id} item={item} showState={tab === "todo"} />
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * One item, with its reason.
 *
 * The note is always visible rather than behind a disclosure. The reason is the
 * part worth keeping, and a list of titles you have to click through is a list
 * nobody reads twice.
 */
function Row({ item, showState }: { item: RoadmapItem; showState: boolean }) {
  return (
    <div className="py-3 border-b border-line/70 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-body font-semibold text-small text-ink text-pretty">
          {item.title}
        </span>
        {showState && (
          <span
            className={`text-caption shrink-0 ${
              item.state === "next" ? "text-violet font-semibold" : "text-text-muted"
            }`}
          >
            {item.state === "next" ? "Next" : "Later"}
          </span>
        )}
      </div>
      <p className="text-caption text-slate mt-1 mb-0 text-pretty leading-relaxed">{item.note}</p>
    </div>
  );
}
