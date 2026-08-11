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
import { StatRow } from "@/components/track/stat-row";
import { ComingUp } from "@/components/track/coming-up";
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
  type HealthProject,
} from "@/lib/project-health";
import { formatDay, relativeDay } from "@/lib/schedule";
import { currencySymbol } from "@/lib/currencies";
import { useAction } from "@/lib/use-action";
import { useT, useLocale } from "@/lib/i18n/context";
import { ActionError } from "@/components/ui/action-error";
import { BillingPanel } from "@/components/track/billing-panel";
import type { BillingMode } from "@/lib/invoice-queue";
import { milestoneProgress } from "@/lib/billing-mode";

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
  const t = useT();
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
          {pending ? t.track.scheduling : t.track.setTheSchedule}
        </Button>
      </div>
      {error && <div className="text-overdue text-small mt-2">{error}</div>}
    </div>
  );
}

/** Asks for the one date everything else follows from. */
function SchedulePrompt({ projectId }: { projectId: string }) {
  const t = useT();
  return (
    <Card>
      <div className="flex items-center gap-2">
        <CalendarDays size={14} className="text-violet" />
        <Label>{t.track.whenDoesThisStart}</Label>
      </div>
      <p className="text-small text-text-muted mt-1 mb-3">
        {t.track.whenDoesThisStartHint}
      </p>
      <ScheduleControls projectId={projectId} />
    </Card>
  );
}

/** The rules return a pace in English; the label is looked up here so a
 * translated interface does not show an untranslated verdict. */
function usePaceLabel() {
  const t = useT();
  return (value: string) =>
    ({
      ahead: t.track.paceAhead,
      "on track": t.track.paceOnTrack,
      slipping: t.track.paceSlipping,
      behind: t.track.paceBehind,
      unscheduled: t.track.notScheduled,
    })[value] ?? value;
}

export function ProjectDetail({
  project,
  projectList,
  billing,
  invoiceCount,
}: {
  project: Project;
  projectList: ProjectSummary[];
  billing: BillingMode;
  /** Invoices already raised against this project. */
  invoiceCount: number;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const paceLabel = usePaceLabel();
  const { run, pending: isPending, error: actionError } = useAction();
  const [price, setPrice] = useState(String(project.price));
  const [hours, setHours] = useState(String(project.hours));
  const [hoursLogged, setHoursLogged] = useState(String(project.hoursLogged));
  const [timeline, setTimeline] = useState(project.timeline);
  const [newDeliverable, setNewDeliverable] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  // Which deliverable is open. The questions worth raising about it now sit
  // inside it, so this no longer drives a panel somewhere else on the page.
  const [openId, setOpenId] = useState<string | null>(
    project.deliverables.find((d) => !d.done)?.id ?? project.deliverables[0]?.id ?? null
  );

  const milestones = milestoneProgress(project.deliverables);
  const health = toHealth(project);
  const completion = projectCompletion(health);
  const currentPace = pace(health);
  const deadlines = upcomingDeadlines(health);
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
      <Card className="w-full lg:w-[172px] lg:shrink-0 lg:overflow-y-auto px-3.5 py-4">
        <Label>{t.track.allProjects}</Label>
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
        <Topbar />

        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
          <div className="min-w-0">
            <h1 className="font-display italic text-[28px] md:text-[30px] text-coral m-0 max-w-[26ch] lg:max-w-none">
              {project.title}
            </h1>
            <p className="text-slate text-small mt-1.5">{project.client}</p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
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
              {t.track.sendToDiary}
            </Button>
            <Button onClick={() => router.push(`/track/${project.id}/invoice`)}>
              {t.track.generateInvoice}, {currencySymbol(project.currency)}
              {project.price.toLocaleString()}
            </Button>
          </div>
        </div>

        <StatRow
          stats={[
            { label: t.track.done, value: `${Math.round(completion * 100)}%` },
            {
              label: t.track.pace,
              value: paceLabel(currentPace),
              alert: currentPace === "behind" || currentPace === "slipping",
              good: currentPace === "ahead",
            },
            {
              label: t.track.nextUp,
              value: next ? relativeDay(next.dueAt, new Date(), locale) : t.track.nothingDated,
              alert: next?.overdue,
            },
            { label: t.track.hours, value: `${project.hoursLogged} / ${project.hours}` },
            // Only on a project that bills per milestone. On any other one it
            // would be a count of deliverables wearing a more important word.
            ...(billing === "PER_MILESTONE" && milestones.total > 0
              ? [
                  {
                    label: t.track.milestone,
                    value: `${milestones.current}/${milestones.total}`,
                  },
                ]
              : []),
          ]}
        />

        {/* Directly under the figures, because what is billable is one of the
            figures: it belongs with "58% done" rather than at the bottom of the
            page under the deliverables. */}
        <BillingPanel
          invoiceCount={invoiceCount}
          project={{
            id: project.id,
            title: project.title,
            client: project.client,
            price: project.price,
            hours: project.hours,
            currency: project.currency || "USD",
            billing,
            status: project.status,
            invoiceCount,
            deliverables: project.deliverables.map((d) => ({
              id: d.id,
              name: d.name,
              done: d.done,
              invoicedAt: d.invoicedAt ? new Date(d.invoicedAt) : null,
              steps: d.steps.map((s) => ({ estimateHours: s.estimateHours })),
            })),
          }}
        />

        {!scheduled ? (
          <SchedulePrompt projectId={project.id} />
        ) : (
          <Card>
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <Label>{t.brief.timeline}</Label>
              <div className="flex items-baseline gap-3">
                <span className="text-meta text-text-muted">
                  {formatDay(health.startDate as Date, locale)} to {formatDay(health.dueDate as Date, locale)}
                </span>
                <button
                  type="button"
                  onClick={() => setRescheduling((r) => !r)}
                  className="text-meta font-semibold text-violet bg-none border-none cursor-pointer p-0"
                >
                  {rescheduling ? t.common.cancel : t.track.reschedule}
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
                  {t.track.rescheduleWarning}
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

        {/* Above the work rather than beside it. In a 270px rail every
            deliverable name was truncated to 34 characters and the questions
            were a column three words wide, on a page with a thousand pixels
            going spare. */}
        <ComingUp deadlines={deadlines} onSelect={setOpenId} />

        <Card>
          <Label>{t.track.deliverables}</Label>
          {project.deliverables.length === 0 ? (
            <div className="text-text-muted text-small mt-1">{t.track.noDeliverables}</div>
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
              placeholder={t.track.addDeliverable}
            />
            <Button
              disabled={!newDeliverable.trim() || isPending}
              onClick={() => {
                const value = newDeliverable;
                setNewDeliverable("");
                void run(() => addDeliverableAction(project.id, value));
              }}
            >
              {t.common.add}
            </Button>
          </div>
        </Card>

        <Card>
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="flex items-baseline justify-between w-full bg-none border-none cursor-pointer p-0"
          >
            <Label>{t.track.projectDetails}</Label>
            <span className="text-meta font-semibold text-violet">
              {showDetails ? t.track.hide : t.common.edit}
            </span>
          </button>

          {showDetails && (
            <div className="flex flex-col gap-2.5 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Field label={`Price (${currencySymbol(project.currency)})`}>
                  <TextField value={price} onChange={setPrice} />
                </Field>
                <Field label={t.track.hoursBudgeted}>
                  <TextField value={hours} onChange={setHours} />
                </Field>
                <Field label={t.track.hoursLogged}>
                  <TextField value={hoursLogged} onChange={setHoursLogged} />
                </Field>
                <Field label={t.brief.timeline}>
                  <TextField value={timeline} onChange={setTimeline} />
                </Field>
              </div>
              <div>
                <div className="text-caption text-text-muted mb-1">{t.track.status}</div>
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
                  {t.common.saveChanges}
                </Button>
                <Button
                  variant="ghost"
                  icon={Trash2}
                  disabled={deleting}
                  onClick={handleDeleteProject}
                  className="text-overdue border-overdue/30 hover:text-overdue"
                >
                  {deleting ? t.common.deleting : t.track.deleteProject}
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
