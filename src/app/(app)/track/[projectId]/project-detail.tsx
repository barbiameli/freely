"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Send, Trash2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TimelineBar } from "@/components/track/timeline-bar";
import { DeliverableItem, type DeliverableView } from "@/components/track/deliverable-item";
import { FlagsPanel } from "@/components/track/flags-panel";
import { FrictionPanel } from "@/components/track/friction-panel";
import { AutoBreakdown } from "@/components/track/auto-breakdown";
import {
  updateProjectAction,
  addDeliverableAction,
  sendToDiaryAction,
  deleteProjectAction,
  type ProjectStatusValue,
} from "@/actions/projects";
import { scheduleProjectAction } from "@/actions/track";
import {
  projectCompletion,
  pace,
  upcomingDeadlines,
  frictionPoints,
  shortName,
  type HealthProject,
} from "@/lib/project-health";
import { formatDay, relativeDay } from "@/lib/schedule";
import { currencySymbol } from "@/lib/currencies";
import { useAction } from "@/lib/use-action";
import { ActionError } from "@/components/ui/action-error";

interface Project {
  id: string;
  title: string;
  client: string;
  status: ProjectStatusValue;
  price: number;
  hours: number;
  hoursLogged: number;
  timeline: string;
  currency?: string | null;
  startDate: string | null;
  dueDate: string | null;
  deliverables: DeliverableView[];
}

interface ProjectSummary {
  id: string;
  title: string;
  client: string;
  status: ProjectStatusValue;
}

const STATUSES: ProjectStatusValue[] = ["ACTIVE", "DUE", "OVERDUE", "DONE"];
const STATUS_DOT: Record<ProjectStatusValue, string> = {
  ACTIVE: "bg-violet",
  DUE: "bg-coral",
  OVERDUE: "bg-overdue",
  DONE: "bg-success",
};

const PACE_STYLE: Record<string, string> = {
  ahead: "text-success",
  "on track": "text-slate",
  slipping: "text-coral",
  behind: "text-overdue",
  unscheduled: "text-text-muted",
};

/** Turns the serialized project into the shape the health rules want. Dates
 * cross the server boundary as strings, and the rules work in Dates. */
function toHealth(project: Project): HealthProject {
  return {
    id: project.id,
    title: project.title,
    client: project.client,
    status: project.status,
    startDate: project.startDate ? new Date(project.startDate) : null,
    dueDate: project.dueDate ? new Date(project.dueDate) : null,
    deliverables: project.deliverables.map((d) => ({
      id: d.id,
      name: d.name,
      done: d.done,
      dueAt: d.dueAt ? new Date(d.dueAt) : null,
      steps: d.steps,
    })),
  };
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="flex-1 min-w-[130px] px-4 py-3.5">
      <Label>{label}</Label>
      <div className={`font-body font-bold text-lead ${tone ?? "text-ink"}`}>{value}</div>
    </Card>
  );
}

/** The date field and its button, shared by the empty state and rescheduling. */
function ScheduleControls({
  projectId,
  initial,
  onDone,
}: {
  projectId: string;
  initial?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [start, setStart] = useState(initial ?? new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          aria-label="Project start date"
          className="font-body text-small text-ink bg-paper border border-line rounded-lg px-2.5 py-2 outline-none"
        />
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await scheduleProjectAction(projectId, start);
              if (result.ok) {
                onDone?.();
                router.refresh();
              } else {
                setError(result.error);
              }
            })
          }
        >
          {pending ? "Scheduling..." : "Set the schedule"}
        </Button>
      </div>
      {error && <div className="text-overdue text-small mt-2">{error}</div>}
    </div>
  );
}

/** Asks for the one date everything else follows from. */
function SchedulePrompt({ projectId }: { projectId: string }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalendarDays size={14} className="text-violet" />
        <Label>When does this start?</Label>
      </div>
      <p className="text-small text-text-muted mt-1 mb-3">
        The quote says how long each stage takes. A start date turns that into real dates on every
        deliverable, which you can then move individually.
      </p>
      <ScheduleControls projectId={projectId} />
    </Card>
  );
}

export function ProjectDetail({
  project,
  projectList,
}: {
  project: Project;
  projectList: ProjectSummary[];
}) {
  const router = useRouter();
  const { run, pending: isPending, error: actionError } = useAction();
  const [price, setPrice] = useState(String(project.price));
  const [hours, setHours] = useState(String(project.hours));
  const [hoursLogged, setHoursLogged] = useState(String(project.hoursLogged));
  const [timeline, setTimeline] = useState(project.timeline);
  const [newDeliverable, setNewDeliverable] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  // The deliverable in focus. Everything on the right follows it, since the
  // questions worth asking depend on which piece of work is in hand.
  const [openId, setOpenId] = useState<string | null>(
    project.deliverables.find((d) => !d.done)?.id ?? project.deliverables[0]?.id ?? null
  );

  const health = toHealth(project);
  const completion = projectCompletion(health);
  const currentPace = pace(health);
  const deadlines = upcomingDeadlines(health);
  const openBlockers = project.deliverables.reduce(
    (sum, d) => sum + d.flags.filter((f) => !f.resolved && f.kind === "BLOCKER").length,
    0
  );
  const friction = frictionPoints(health, openBlockers);
  const focused = project.deliverables.find((d) => d.id === openId) ?? null;
  const scheduled = Boolean(health.startDate && health.dueDate);
  const next = deadlines[0] ?? null;

  function commit(patch: Parameters<typeof updateProjectAction>[1]) {
    void run(() => updateProjectAction(project.id, patch));
  }

  async function handleDeleteProject() {
    if (
      !window.confirm(
        `Delete "${project.title}"? This removes its deliverables and diary entries too, this can't be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    // A failed delete used to leave the button stuck on "Deleting..." with no
    // explanation, since the result was checked but never shown.
    await run(() => deleteProjectAction(project.id), {
      skipRefresh: true,
      onSuccess: () => router.push("/track"),
    });
    setDeleting(false);
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 flex-1 min-h-0">
      <Card className="w-full lg:w-[200px] lg:shrink-0 lg:overflow-y-auto">
        <Label>All projects</Label>
        <div className="flex flex-col gap-1 mt-1">
          {projectList.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/track/${p.id}`)}
              className={`flex items-center gap-2 text-left px-2.5 py-2 rounded-lg cursor-pointer border-none ${
                p.id === project.id ? "bg-violet-tint" : "bg-transparent hover:bg-paper"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[p.status]}`} />
              <span
                className={`text-small truncate ${
                  p.id === project.id ? "font-bold text-violet" : "font-medium text-slate"
                }`}
              >
                {p.title}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-5 md:gap-6 flex-1 min-w-0">
        <Topbar eyebrow={`Track - ${project.title}`} />

        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
          <div>
            <h1 className="font-display italic text-[28px] md:text-[30px] text-coral m-0">
              {project.title}
            </h1>
            <p className="text-slate text-small mt-1.5">{project.client}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="ghost"
              icon={Send}
              disabled={isPending}
              onClick={() =>
                run(() => sendToDiaryAction(project.id), {
                  skipRefresh: true,
                  onSuccess: () => router.push(`/diary/${project.id}`),
                })
              }
            >
              Send to Diary
            </Button>
            <Button onClick={() => router.push(`/track/${project.id}/invoice`)}>
              Generate invoice, {currencySymbol(project.currency)}
              {project.price.toLocaleString()}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Stat label="Done" value={`${Math.round(completion * 100)}%`} />
          <Stat
            label="Pace"
            value={currentPace === "unscheduled" ? "Not scheduled" : currentPace}
            tone={PACE_STYLE[currentPace]}
          />
          <Stat
            label="Next up"
            value={next ? relativeDay(next.dueAt) : "Nothing dated"}
            tone={next?.overdue ? "text-overdue" : undefined}
          />
          <Stat label="Hours" value={`${project.hoursLogged} of ${project.hours}`} />
        </div>

        {!scheduled ? (
          <SchedulePrompt projectId={project.id} />
        ) : (
          <Card>
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <Label>Timeline</Label>
              <div className="flex items-baseline gap-3">
                <span className="text-meta text-text-muted">
                  {formatDay(health.startDate as Date)} to {formatDay(health.dueDate as Date)}
                </span>
                <button
                  type="button"
                  onClick={() => setRescheduling((r) => !r)}
                  className="text-meta font-semibold text-violet bg-none border-none cursor-pointer p-0"
                >
                  {rescheduling ? "Cancel" : "Reschedule"}
                </button>
              </div>
            </div>
            {rescheduling && (
              <div className="mb-4">
                <ScheduleControls
                  projectId={project.id}
                  initial={(project.startDate as string).slice(0, 10)}
                  onDone={() => setRescheduling(false)}
                />
                <p className="text-caption text-text-muted mt-2 mb-0">
                  This resets every deliverable date. Dates you moved by hand go back to the
                  derived ones.
                </p>
              </div>
            )}
            <TimelineBar
              startDate={health.startDate as Date}
              dueDate={health.dueDate as Date}
              markers={project.deliverables
                .filter((d) => d.dueAt)
                .map((d) => ({
                  id: d.id,
                  name: d.name,
                  dueAt: new Date(d.dueAt as string),
                  done: d.done,
                }))}
            />
          </Card>
        )}

        <AutoBreakdown
          projectId={project.id}
          pending={project.deliverables.filter((d) => !d.brokenDown).length}
          total={project.deliverables.length}
        />

        <ActionError error={actionError} />

        <FrictionPanel friction={friction} />

        {deadlines.length > 0 && (
          <Card>
            <Label>Coming up</Label>
            <div className="flex flex-col gap-1.5 mt-1.5">
              {deadlines.slice(0, 5).map((d) => (
                <button
                  key={d.deliverableId}
                  type="button"
                  onClick={() => setOpenId(d.deliverableId)}
                  className="flex items-baseline justify-between gap-3 text-left bg-none border-none cursor-pointer p-0"
                >
                  <span className="text-small text-ink truncate" title={d.name}>
                    {shortName(d.name)}
                  </span>
                  <span
                    className={`text-meta shrink-0 ${
                      d.overdue ? "text-overdue font-semibold" : "text-text-muted"
                    }`}
                  >
                    {formatDay(d.dueAt)} · {relativeDay(d.dueAt)}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        <div className="flex flex-col lg:flex-row gap-5">
          <Card className="flex-1 min-w-0">
            <Label>Deliverables</Label>
            {project.deliverables.length === 0 ? (
              <div className="text-text-muted text-small mt-1">No deliverables listed.</div>
            ) : (
              <div className="mt-1">
                {project.deliverables.map((d) => (
                  <DeliverableItem
                    key={d.id}
                    deliverable={d}
                    projectId={project.id}
                    expanded={openId === d.id}
                    onToggleExpanded={() => setOpenId(openId === d.id ? null : d.id)}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <TextField
                value={newDeliverable}
                onChange={setNewDeliverable}
                placeholder="Add a deliverable"
              />
              <Button
                disabled={!newDeliverable.trim() || isPending}
                onClick={() => {
                  const value = newDeliverable;
                  setNewDeliverable("");
                  void run(() => addDeliverableAction(project.id, value));
                }}
              >
                Add
              </Button>
            </div>
          </Card>

          <Card className="w-full lg:w-[280px] lg:shrink-0 self-start">
            <FlagsPanel deliverable={focused} />
          </Card>
        </div>

        <Card>
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="flex items-baseline justify-between w-full bg-none border-none cursor-pointer p-0"
          >
            <Label>Project details</Label>
            <span className="text-meta font-semibold text-violet">
              {showDetails ? "Hide" : "Edit"}
            </span>
          </button>

          {showDetails && (
            <div className="flex flex-col gap-2.5 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Field label={`Price (${currencySymbol(project.currency)})`}>
                  <TextField value={price} onChange={setPrice} />
                </Field>
                <Field label="Hours budgeted">
                  <TextField value={hours} onChange={setHours} />
                </Field>
                <Field label="Hours logged">
                  <TextField value={hoursLogged} onChange={setHoursLogged} />
                </Field>
                <Field label="Timeline">
                  <TextField value={timeline} onChange={setTimeline} />
                </Field>
              </div>
              <div>
                <div className="text-caption text-text-muted mb-1">Status</div>
                <div className="flex gap-1.5 flex-wrap">
                  {STATUSES.map((s) => (
                    <Chip
                      key={s}
                      active={project.status === s}
                      onClick={() => commit({ status: s })}
                    >
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5 mt-1">
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    commit({
                      price: Number(price) || 0,
                      hours: Number(hours) || 0,
                      hoursLogged: Number(hoursLogged) || 0,
                      timeline,
                    })
                  }
                >
                  Save changes
                </Button>
                <Button
                  variant="ghost"
                  icon={Trash2}
                  disabled={deleting}
                  onClick={handleDeleteProject}
                  className="text-overdue border-overdue/30 hover:text-overdue"
                >
                  {deleting ? "Deleting..." : "Delete project"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-caption text-text-muted mb-1">{label}</div>
      {children}
    </div>
  );
}
