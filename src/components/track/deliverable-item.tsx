"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Pencil, Sparkles } from "lucide-react";
import {
  breakDownDeliverableAction,
  toggleStepAction,
  replaceStepsAction,
  setDeliverableDueAction,
} from "@/actions/track";
import { toggleDeliverableAction } from "@/actions/projects";
import { deliverableCompletion, shortName } from "@/lib/project-health";
import { formatDay } from "@/lib/schedule";
import { useAction } from "@/lib/use-action";
import { useOptimisticFlag } from "@/lib/use-optimistic-flag";
import { ActionError } from "@/components/ui/action-error";
// Not a cycle: flags-panel only takes the types from here, and a type import is
// erased before anything runs.
import { FlagsPanel } from "@/components/track/flags-panel";
import { useT, useLocale } from "@/lib/i18n/context";

export interface StepView {
  id: string;
  name: string;
  done: boolean;
  estimateHours: number;
}

export interface FlagView {
  id: string;
  question: string;
  reason: string | null;
  kind: "BLOCKER" | "ASSUMPTION" | "WORTH_ASKING";
  resolved: boolean;
}

export interface DeliverableView {
  id: string;
  name: string;
  done: boolean;
  dueAt: string | null;
  summary: string | null;
  brokenDown: boolean;
  /** When this milestone was billed, on a per-milestone project. */
  invoicedAt: string | null;
  /** When it was ticked off. Null on anything finished before this was
   * recorded, so nothing depends on it being there. */
  doneAt?: string | null;
  /** Which milestone covers it, null when the project has none. */
  milestoneId?: string | null;
  steps: StepView[];
  flags: FlagView[];
}

function Checkbox({
  done,
  onClick,
  label,
  size = 17,
}: {
  done: boolean;
  onClick: () => void;
  label: string;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={done}
      style={{ width: size, height: size }}
      // tap-row rather than tap: these sit one per row about 44px apart, and
      // the full expansion would have neighbouring hit areas overlap.
      className={`rounded-[5px] flex items-center justify-center shrink-0 cursor-pointer p-0 tap-row transition-colors ${
        done ? "bg-violet border-none" : "bg-white border border-line hover:border-slate"
      }`}
    >
      {done && <Check size={size * 0.6} className="text-white" />}
    </button>
  );
}

/**
 * One step, ticking immediately.
 *
 * Its own component because each row needs its own optimistic state, and a
 * hook cannot be called inside a map.
 */
function StepRow({ step, onDone }: { step: StepView; onDone?: (name: string) => void }) {
  const router = useRouter();
  const [done, toggle] = useOptimisticFlag(step.done, (next) =>
    toggleStepAction(step.id, next).then((r) => {
      if (r.ok) router.refresh();
      return r;
    })
  );

  return (
    <div className="flex items-start gap-3 py-2 border-b border-line/70 last:border-b-0">
      <Checkbox
        size={15}
        done={done}
        label={`Mark step ${done ? "not done" : "done"}`}
        onClick={() => {
          // Only on the way to done. Unticking is a correction, and offering to
          // tell the client about a correction would be strange.
          if (!done) onDone?.(step.name);
          toggle();
        }}
      />
      {/* Ink rather than slate. It was the same grey as the description above
          it, so the paragraph and the checklist read as one block of text. */}
      <span
        className={`flex-1 text-small leading-[1.55] ${
          done ? "text-text-muted line-through" : "text-ink"
        }`}
      >
        {step.name}
      </span>
      <span className="text-caption text-text-muted tabular-nums shrink-0 pt-[3px] w-9 text-right">
        {step.estimateHours > 0 ? `${step.estimateHours}h` : ""}
      </span>
    </div>
  );
}

/**
 * One deliverable, with its steps.
 *
 * Editing used to be per step: click the text, change it, blur to save, with a
 * delete on hover and a separate add field. That is four affordances per row on
 * a list of eight rows. One Edit on the deliverable opens every step as plain
 * text instead, one per line, which is also how you reorder, delete and add
 * them: it is a list, so editing it as a list is less to learn than a set of
 * per-row controls.
 */
export function DeliverableItem({
  deliverable,
  projectId,
  expanded,
  onToggleExpanded,
  onDone,
}: {
  deliverable: DeliverableView;
  projectId: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** Something was ticked off. Collected by the page so it can offer to write
   * it up for the client while it is still fresh. */
  onDone?: (name: string, deliverable: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [breaking, setBreaking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingDate, setEditingDate] = useState(false);

  const dueAt = deliverable.dueAt ? new Date(deliverable.dueAt) : null;
  const overdue = Boolean(dueAt && !deliverable.done && dueAt < new Date());
  const completion = deliverableCompletion({
    id: deliverable.id,
    name: deliverable.name,
    done: deliverable.done,
    dueAt,
    steps: deliverable.steps,
  });
  // Ticked locally first, written behind it. See lib/use-optimistic-flag.
  // The action flips whatever the row currently is, so it takes no argument.
  const [done, toggleDone] = useOptimisticFlag(deliverable.done, () =>
    toggleDeliverableAction(projectId, deliverable.id).then((r) => {
      if (r.ok) router.refresh();
      return r;
    })
  );

  const doneCount = deliverable.steps.filter((s) => s.done).length;

  function openEditor() {
    setDraft(deliverable.steps.map((s) => s.name).join("\n"));
    setEditing(true);
  }

  async function saveSteps() {
    const names = draft
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
    setEditing(false);
    await run(() => replaceStepsAction(deliverable.id, names));
  }

  async function runBreakdown() {
    setBreaking(true);
    await run(() => breakDownDeliverableAction(deliverable.id));
    setBreaking(false);
  }

  return (
    <div className="border-b border-line last:border-b-0">
      <div className="flex items-start gap-3 py-3">
        <Checkbox
          done={done}
          label={`Mark ${shortName(deliverable.name, 40)} ${done ? "not done" : "done"}`}
          onClick={() => {
            if (!done) onDone?.(deliverable.name, deliverable.name);
            toggleDone();
          }}
        />

        <button
          type="button"
          onClick={onToggleExpanded}
          title={deliverable.name}
          className="flex-1 min-w-0 text-left bg-none border-none cursor-pointer p-0 flex items-start gap-1.5"
        >
          {/* Its own column, so a title that wraps does not drag the chevron
              down beside the second line. */}
          <span className="shrink-0 pt-[3px]">
            {expanded ? (
              <ChevronDown size={13} className="text-text-muted" />
            ) : (
              <ChevronRight size={13} className="text-text-muted" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            {/* The whole name. It was cut to 56 characters with an ellipsis on a
                row that is now the width of the page, so "Site audit: review
                live site against component librar..." was hiding two words
                behind a truncation with a thousand pixels to spare. Clamped to
                two lines when closed, uncapped when open, both by CSS, which
                only truncates when there is actually no room. */}
            {/* 15px against the 13px of the steps below. At 14 it was one pixel
                bigger than its own checklist, so nothing on the row looked like
                the heading of anything. Size, weight and colour all do a bit of
                the work: 15 semibold ink for the name, 13 slate for what it is,
                13 ink for the steps, 11 muted for the hours. */}
            <span
              className={`block font-body font-semibold text-lead leading-snug tracking-[-0.01em] ${
                expanded ? "" : "line-clamp-2"
              } ${done ? "text-text-muted line-through" : "text-ink"}`}
            >
              {deliverable.name}
            </span>
          {/* The bar only once there is something to show. Empty, it was a grey
              dash under every title that read as a rule or a mistake, and the
              count beside it already said 0 of 8. */}
          {deliverable.steps.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              {doneCount > 0 && (
                <div className="w-16 h-[3px] rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet"
                    style={{ width: `${Math.round(completion * 100)}%` }}
                  />
                </div>
              )}
              <span className="text-caption text-text-muted tabular-nums">
                {t.track.stepsOf
                  .replace("{done}", String(doneCount))
                  .replace("{total}", String(deliverable.steps.length))}
              </span>
            </div>
          )}
          </span>
        </button>

        <div className="shrink-0 pt-0.5">
          {editingDate ? (
            <input
              type="date"
              autoFocus
              defaultValue={deliverable.dueAt ? deliverable.dueAt.slice(0, 10) : ""}
              onBlur={() => setEditingDate(false)}
              onChange={(e) => {
                const value = e.target.value || null;
                setEditingDate(false);
                void run(() => setDeliverableDueAction(deliverable.id, value));
              }}
              className="font-body text-caption text-ink bg-white border border-violet rounded-md px-1.5 py-1 outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingDate(true)}
              title={t.track.changeThisDate}
              className={`text-caption tabular-nums bg-none border-none cursor-pointer p-0 tap ${
                overdue ? "text-overdue font-semibold" : "text-text-muted hover:text-slate"
              }`}
            >
              {dueAt ? formatDay(dueAt, locale) : t.track.setDate}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="pb-4 pl-[30px] pr-1 max-w-[74ch]">
          {/* One measure for everything in here, set in ch so it tracks the font
              rather than a pixel width that was right at one column width and
              wrong at the next.
              It used to be per block: the description broke at 78ch and the step
              list ran to 92ch, so the two had different right edges and the
              hours column sat a long way from the text it belonged to. One
              measure on the container fixes both, and 74ch is a readable line
              rather than the longest one that fits. */}
          {/* text-balance evens the lines out. Left to itself the browser fills
              line one to the measure and drops whatever is left onto line two,
              so a two-line summary broke mid-clause after "so every" with a
              third of the width empty beside it. Balanced, both lines are about
              the same length and the break lands somewhere a person would put
              it. Browsers cap this at a few lines, which is all this ever is. */}
          {deliverable.summary && !editing && (
            <p className="text-small text-slate leading-[1.6] mt-0 mb-3.5 text-balance">
              {deliverable.summary}
            </p>
          )}

          {editing ? (
            <div>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setEditing(false);
                }}
                rows={Math.min(16, Math.max(4, draft.split("\n").length + 1))}
                className="w-full font-body text-small text-ink leading-relaxed bg-white border border-violet rounded-lg px-3 py-2.5 outline-none"
              />
              <p className="text-caption text-text-muted mt-1.5 mb-0">
                {t.track.oneStepPerLine}
              </p>
              <div className="flex items-center gap-3 mt-2.5">
                <button
                  type="button"
                  onClick={saveSteps}
                  disabled={pending}
                  className="font-body font-bold text-meta text-white bg-violet rounded-lg px-3.5 py-1.5 border-none cursor-pointer disabled:opacity-50"
                >
                  {pending ? t.common.saving : t.track.saveSteps}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-meta text-text-muted bg-none border-none cursor-pointer p-0 tap"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          ) : deliverable.steps.length === 0 ? (
            <button
              type="button"
              onClick={runBreakdown}
              disabled={breaking}
              className="flex items-center gap-1.5 text-meta font-bold text-white bg-violet rounded-lg px-3 py-1.5 border-none cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={12} />
              {breaking ? t.track.workingItOut : t.track.breakThisDown}
            </button>
          ) : (
            <>
              {/* Hairlines between the steps rather than nothing, because a
                  checklist of eight with only leading between the rows reads as
                  a paragraph with boxes down the side. The hours stay in a
                  fixed column so they can be read down. */}
              <div className="flex flex-col border-t border-line/70">
                {deliverable.steps.map((step) => (
                  <StepRow
                    key={step.id}
                    step={step}
                    onDone={(name) => onDone?.(name, deliverable.name)}
                  />
                ))}
              </div>

              <div className="flex items-center gap-4 mt-3">
                <button
                  type="button"
                  onClick={openEditor}
                  className="flex items-center gap-1.5 text-caption font-semibold text-violet bg-none border-none cursor-pointer p-0 tap"
                >
                  <Pencil size={11} /> {t.track.editSteps}
                </button>
                <button
                  type="button"
                  onClick={runBreakdown}
                  disabled={breaking}
                  className="flex items-center gap-1.5 text-caption text-text-muted hover:text-slate bg-none border-none cursor-pointer p-0 tap disabled:opacity-50"
                >
                  <Sparkles size={11} />
                  {breaking ? t.track.workingItOut : t.track.redo}
                </button>
              </div>
            </>
          )}

          <ActionError error={error} className="mt-2" />

          {/* Last thing in the open deliverable, because it is the thing you act
              on after reading the work rather than before. */}
          {!editing && <FlagsPanel deliverable={deliverable} />}
        </div>
      )}
    </div>
  );
}
