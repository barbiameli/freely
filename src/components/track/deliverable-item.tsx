"use client";

import { useState } from "react";
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
import { ActionError } from "@/components/ui/action-error";
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
      className={`rounded-[5px] flex items-center justify-center shrink-0 cursor-pointer p-0 transition-colors ${
        done ? "bg-violet border-none" : "bg-white border border-line hover:border-slate"
      }`}
    >
      {done && <Check size={size * 0.6} className="text-white" />}
    </button>
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
}: {
  deliverable: DeliverableView;
  projectId: string;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const t = useT();
  const locale = useLocale();
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
          done={deliverable.done}
          label={`Mark ${shortName(deliverable.name, 40)} ${deliverable.done ? "not done" : "done"}`}
          onClick={() => run(() => toggleDeliverableAction(projectId, deliverable.id))}
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
            <span
              className={`block font-body font-semibold text-body tracking-[-0.01em] line-clamp-2 ${
                deliverable.done ? "text-text-muted line-through" : "text-ink"
              }`}
            >
              {shortName(deliverable.name, 56)}
            </span>
          {deliverable.steps.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="w-16 h-[3px] rounded-full bg-line overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet"
                  style={{ width: `${Math.round(completion * 100)}%` }}
                />
              </div>
              <span className="text-caption text-text-muted tabular-nums">
                {doneCount}/{deliverable.steps.length}
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
              className={`text-caption tabular-nums bg-none border-none cursor-pointer p-0 ${
                overdue ? "text-overdue font-semibold" : "text-text-muted hover:text-slate"
              }`}
            >
              {dueAt ? formatDay(dueAt, locale) : t.track.setDate}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="pb-4 pl-[30px] pr-1">
          {deliverable.summary && !editing && (
            <p className="text-small text-slate leading-relaxed mt-0 mb-3 max-w-[62ch]">
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
                  className="text-meta text-text-muted bg-none border-none cursor-pointer p-0"
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
              <div className="flex flex-col gap-0.5">
                {deliverable.steps.map((step) => (
                  <div key={step.id} className="flex items-start gap-2.5 py-1">
                    <Checkbox
                      size={15}
                      done={step.done}
                      label={`Mark step ${step.done ? "not done" : "done"}`}
                      onClick={() => run(() => toggleStepAction(step.id, !step.done))}
                    />
                    <span
                      className={`flex-1 text-small leading-relaxed ${
                        step.done ? "text-text-muted line-through" : "text-slate"
                      }`}
                    >
                      {step.name}
                    </span>
                    {step.estimateHours > 0 && (
                      <span className="text-caption text-text-muted tabular-nums shrink-0 pt-[3px]">
                        {step.estimateHours}h
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 mt-3">
                <button
                  type="button"
                  onClick={openEditor}
                  className="flex items-center gap-1.5 text-caption font-semibold text-violet bg-none border-none cursor-pointer p-0"
                >
                  <Pencil size={11} /> {t.track.editSteps}
                </button>
                <button
                  type="button"
                  onClick={runBreakdown}
                  disabled={breaking}
                  className="flex items-center gap-1.5 text-caption text-text-muted hover:text-slate bg-none border-none cursor-pointer p-0 disabled:opacity-50"
                >
                  <Sparkles size={11} />
                  {breaking ? t.track.workingItOut : t.track.redo}
                </button>
              </div>
            </>
          )}

          <ActionError error={error} className="mt-2" />
        </div>
      )}
    </div>
  );
}
