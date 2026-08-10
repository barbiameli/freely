"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  breakDownDeliverableAction,
  toggleStepAction,
  updateStepAction,
  addStepAction,
  deleteStepAction,
  setDeliverableDueAction,
} from "@/actions/track";
import { toggleDeliverableAction } from "@/actions/projects";
import { deliverableCompletion, shortName } from "@/lib/project-health";
import { formatDay, relativeDay } from "@/lib/schedule";
import { useAction } from "@/lib/use-action";
import { ActionError } from "@/components/ui/action-error";

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
  steps: StepView[];
  flags: FlagView[];
}

function Checkbox({ done, onClick, label }: { done: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={done}
      className={`w-[17px] h-[17px] rounded-[5px] flex items-center justify-center shrink-0 cursor-pointer p-0 ${
        done ? "bg-violet border-none" : "bg-white border border-line"
      }`}
    >
      {done && <Check size={10} className="text-white" />}
    </button>
  );
}

/** One step, editable in place. Generated steps are a starting point, not an
 * instruction, so changing the wording has to be as easy as ticking it. */
function StepRow({ step }: { step: StepView }) {
  const { run, pending, error } = useAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(step.name);

  function save() {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === step.name) {
      setDraft(step.name);
      return;
    }
    void run(() => updateStepAction(step.id, next));
  }

  return (
    <div className="group py-1.5">
      <div className="flex items-start gap-2.5">
      <Checkbox
        done={step.done}
        label={`Mark "${step.name}" ${step.done ? "not done" : "done"}`}
        onClick={() => run(() => toggleStepAction(step.id, !step.done))}
      />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(step.name);
              setEditing(false);
            }
          }}
          className="flex-1 font-body text-[13px] text-ink bg-white border border-violet rounded-md px-2 py-1 outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Edit this step"
          className={`flex-1 text-left text-[13px] leading-snug bg-none border-none cursor-text p-0 ${
            step.done ? "text-text-muted line-through" : "text-ink"
          }`}
        >
          {step.name}
        </button>
      )}
      {step.estimateHours > 0 && (
        <span className="text-[11px] text-text-muted shrink-0 pt-0.5">{step.estimateHours}h</span>
      )}
      <button
        type="button"
        disabled={pending}
        aria-label={`Delete step "${step.name}"`}
        onClick={() => run(() => deleteStepAction(step.id))}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-text-muted hover:text-overdue bg-none border-none cursor-pointer p-0 pt-0.5 shrink-0 disabled:opacity-30"
      >
        <Trash2 size={11} />
      </button>
      </div>
      <ActionError error={error} className="ml-7 mt-1" />
    </div>
  );
}

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
  const { run, pending, error } = useAction();
  const [breaking, setBreaking] = useState(false);
  const [newStep, setNewStep] = useState("");
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
  const openBlockers = deliverable.flags.filter((f) => !f.resolved && f.kind === "BLOCKER").length;

  async function runBreakdown() {
    setBreaking(true);
    await run(() => breakDownDeliverableAction(deliverable.id));
    setBreaking(false);
  }

  return (
    <div className="border-b border-line last:border-b-0">
      <div className="flex items-start gap-2.5 py-3">
        <Checkbox
          done={deliverable.done}
          label={`Mark "${deliverable.name}" ${deliverable.done ? "not done" : "done"}`}
          onClick={() => run(() => toggleDeliverableAction(projectId, deliverable.id))}
        />

        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex-1 min-w-0 text-left bg-none border-none cursor-pointer p-0"
        >
          <div className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown size={13} className="text-text-muted shrink-0" />
            ) : (
              <ChevronRight size={13} className="text-text-muted shrink-0" />
            )}
            <span
              title={deliverable.name}
              className={`font-body font-semibold text-[13.5px] ${
                deliverable.done ? "text-text-muted" : "text-ink"
              }`}
            >
              {/* Quote deliverables are written for a client, so the name is
                  often a full sentence. The heading takes the leading clause
                  and the rest shows when it is opened. */}
              {expanded ? deliverable.name : shortName(deliverable.name, 70)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 ml-[19px] text-[11.5px] text-text-muted">
            {deliverable.steps.length > 0 && (
              <span>
                {deliverable.steps.filter((s) => s.done).length} of {deliverable.steps.length} steps
              </span>
            )}
            {deliverable.steps.length > 0 && <span>{Math.round(completion * 100)}%</span>}
            {openBlockers > 0 && (
              <span className="text-overdue font-semibold">
                {openBlockers} blocking question{openBlockers === 1 ? "" : "s"}
              </span>
            )}
          </div>
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
              className="font-body text-[11.5px] text-ink bg-white border border-violet rounded-md px-1.5 py-1 outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingDate(true)}
              title="Change this date"
              className={`text-[11.5px] bg-none border-none cursor-pointer p-0 ${
                overdue ? "text-overdue font-semibold" : "text-text-muted"
              }`}
            >
              {dueAt ? `${formatDay(dueAt)} · ${relativeDay(dueAt)}` : "Set a date"}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="pb-4 pl-[27px] pr-1">
          {deliverable.summary && (
            <p className="text-[12.5px] text-slate leading-relaxed mt-0 mb-3">
              {deliverable.summary}
            </p>
          )}

          {deliverable.steps.length === 0 ? (
            <div className="bg-paper rounded-lg px-3.5 py-3">
              <p className="text-[12.5px] text-slate m-0">
                No steps on this one yet.
              </p>
              <button
                type="button"
                onClick={runBreakdown}
                disabled={breaking}
                className="flex items-center gap-1.5 mt-2.5 text-[12px] font-bold text-white bg-violet rounded-lg px-3 py-1.5 border-none cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={12} />
                {breaking ? "Working it out..." : "Break this down"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col">
                {deliverable.steps.map((step) => (
                  <StepRow key={step.id} step={step} />
                ))}
              </div>

              <div className="flex items-center gap-2 mt-2.5">
                <input
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newStep.trim()) {
                      const value = newStep;
                      setNewStep("");
                      void run(() => addStepAction(deliverable.id, value));
                    }
                  }}
                  placeholder="Add a step"
                  className="flex-1 font-body text-[12.5px] text-ink bg-paper border-none rounded-lg px-2.5 py-1.5 outline-none"
                />
                <button
                  type="button"
                  disabled={!newStep.trim() || pending}
                  onClick={() => {
                    const value = newStep;
                    setNewStep("");
                    void run(() => addStepAction(deliverable.id, value));
                  }}
                  aria-label="Add step"
                  className="w-7 h-7 rounded-lg bg-paper border-none flex items-center justify-center cursor-pointer text-slate disabled:opacity-40"
                >
                  <Plus size={13} />
                </button>
              </div>

              <button
                type="button"
                onClick={runBreakdown}
                disabled={breaking}
                className="flex items-center gap-1.5 mt-3 text-[11.5px] font-semibold text-violet bg-none border-none cursor-pointer p-0 disabled:opacity-50"
              >
                <Sparkles size={11} />
                {breaking ? "Working it out..." : "Redo the breakdown"}
              </button>
              <p className="text-[11px] text-text-muted mt-1 mb-0">
                Ticked steps and their wording are kept.
              </p>
            </>
          )}

          <ActionError error={error} className="mt-2" />
        </div>
      )}
    </div>
  );
}
