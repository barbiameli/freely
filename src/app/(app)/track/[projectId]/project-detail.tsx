"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TimePanel } from "@/components/track/time-panel";
import { TimerButton } from "@/components/track/timer-button";
import { TimeSetUp } from "@/components/track/time-set-up";
import type { TimeMode } from "@/lib/time-tracking";
import type { WeekEntry } from "@/lib/time-week";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { relativeDay } from "@/lib/schedule";
import { Chip } from "@/components/ui/chip";
import { Popover } from "@/components/ui/popover";
import { TimelineBar } from "@/components/track/timeline-bar";
import { DeliverableItem, type DeliverableView } from "@/components/track/deliverable-item";
import { DiaryPrompt, type DoneItem } from "@/components/track/diary-prompt";
import { StatRow } from "@/components/track/stat-row";
import { ComingUp } from "@/components/track/coming-up";
import { BreakdownSuggestion } from "@/components/track/breakdown-suggestion";
import { Confirm } from "@/components/ui/confirm";
import {
  updateProjectAction,
  addDeliverableAction,
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
import { currencySymbol } from "@/lib/currencies";
import { formatMoney } from "@/lib/money";
import { useAction } from "@/lib/use-action";
import { useT, useLocale } from "@/lib/i18n/context";
import { ActionError } from "@/components/ui/action-error";
import type { BillingMode } from "@/lib/invoice-queue";
import { milestoneProgress, type MilestoneView } from "@/lib/milestones";
import { RecordHeader } from "@/components/ui/page-header";
import { Board } from "@/components/track/board";
import { PlanSetup } from "@/components/track/plan-setup";
import { Timeline } from "@/components/track/timeline";

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
  /** When the project shape was settled. Null means never. */
  plannedAt?: string | null;
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
          loading={pending}
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
  milestones: quotedMilestones = [],
  /** The Your work / What the client sees strip, placed in the title row. */
  clientLink,
  time,
}: {
  project: Project;
  projectList: ProjectSummary[];
  billing: BillingMode;
  /** Hours on this engagement, and what tracking them is for. */
  time: {
    mode: TimeMode | null;
    loggedSeconds: number;
    /** Everything logged on this project, for the week view and the log. */
    entries: WeekEntry[];
    running: { startedAt: string; note?: string; stepId?: string | null } | null;
    hasCalendar: boolean;
  };
  /**
   * The milestones agreed on the quote, in order.
   *
   * Empty on a project billed on completion, and on anything quoted before
   * milestones existed. Read-only here: the split is part of what the client
   * agreed to, so the tracker shows it rather than offering to rearrange it.
   */
  milestones?: MilestoneView[];
  /**
   * Whether the client can see this project, and where.
   *
   * Was a two-tab strip whose second tab was a whole second page. That page's
   * contents moved to the client, so what is left is a switch and an address.
   */
  clientLink?: ReactNode;
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
  const [confirming, setConfirming] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  // Which deliverable is open. The questions worth raising about it now sit
  // inside it, so this no longer drives a panel somewhere else on the page.
  /**
   * Board or list.
   *
   * Not persisted on purpose: it is a way of looking at one project on one
   * afternoon, not a setting, and a remembered view is one more thing that has
   * silently changed when somebody comes back to a page.
   */
  const [view, setView] = useState<"board" | "timeline">("board");

  /**
   * The one-time "what is this tracking for" question.
   *
   * Lives here rather than inside the panel now, because the header button is
   * the first place somebody presses play and it has to be able to ask.
   */
  const [settingUpTimer, setSettingUpTimer] = useState(false);

  /**
   * Whether the plan panel is open.
   *
   * Open by default until a project has been planned, and reachable forever
   * after. It used to be a one-time gate on plannedAt, so once a project was
   * planned there was no way to change the dates, the hours, the working days
   * or the stars. Those are exactly the things that change: a client moves a
   * date, a deliverable turns out to be twice the work, somebody drops to
   * three days a week. The star was worst affected, since you only learn
   * which deliverable deserved the time by starting.
   */
  const [replanning, setReplanning] = useState(false);

  /**
   * Every task on the project, flattened out of its deliverable.
   *
   * The board is columns of tasks rather than a list of deliverables, so the
   * nesting the quote gave us is carried by a tag on each card instead.
   */
  const allSteps = project.deliverables.flatMap((d) =>
    d.steps.map((step) => ({
      id: step.id,
      name: step.name,
      done: step.done,
      startedAt: step.startedAt ?? null,
      order: step.order ?? 0,
      estimateHours: step.estimateHours,
      deliverableId: d.id,
    }))
  );

  const [openId, setOpenId] = useState<string | null>(
    project.deliverables.find((d) => !d.done)?.id ?? project.deliverables[0]?.id ?? null
  );

  const milestones = milestoneProgress(quotedMilestones, project.deliverables);

  // What has been ticked off since this page was opened. Held here rather than
  // in the rows so a run of five ticks produces one offer to write it up, and
  // so ticking a step in one deliverable and a step in another still reads as
  // one update.
  const [justDone, setJustDone] = useState<DoneItem[]>([]);
  function noteDone(name: string, deliverable: string) {
    setJustDone((items) =>
      items.some((item) => item.name === name) ? items : [...items, { name, deliverable }]
    );
  }
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
    setConfirming(false);
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
    /*
     * One column, not two.
     *
     * A 172px card listing every other project sat down the left of this page
     * for the whole of its life, permanently spending a sixth of the width on
     * a question nobody asks while working: "which other projects exist". It
     * also put a second vertical rail next to the app's own, so the board had
     * two navigation columns to its left before it started.
     *
     * The switcher is now a button in the header carrying the current
     * project's name, which is where somebody looks to find out where they
     * are, and the list opens from it when they actually want to move.
     */
    <div className="flex flex-col gap-5 lg:gap-6 flex-1 min-h-0">
      <div className="flex flex-col gap-5 md:gap-6 flex-1 min-w-0">
        {/* The account controls share this row rather than having one of
            their own. A bell and an avatar are not worth a band of the page,
            and that band sat between the top of the screen and the project's
            name on every visit. */}
        <div className="flex items-center gap-3">
        {/* Where you are, and the way to somewhere else. */}
        <Popover
          label={t.track.allProjects}
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="self-start inline-flex items-center gap-1.5 bg-none border-none cursor-pointer p-0 tap"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[project.status]}`} />
              <span className="font-body font-semibold text-small text-slate truncate max-w-[52vw]">
                {project.title}
              </span>
              <ChevronDown size={13} className="text-text-muted shrink-0" />
            </button>
          )}
        >
          {({ close }) => (
            <div className="flex flex-col gap-0.5 p-2 max-h-[60vh] overflow-y-auto">
              {projectList.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    close();
                    router.push(`/track/${p.id}`);
                  }}
                  className={`flex items-center gap-2 text-left px-2.5 py-2 rounded-lg cursor-pointer border-none w-full ${
                    p.id === project.id ? "bg-violet-tint" : "bg-transparent hover:bg-paper"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[p.status]}`} />
                  <span
                    className={`text-small truncate ${
                      p.id === project.id ? "font-bold text-link" : "font-medium text-slate"
                    }`}
                  >
                    {p.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Popover>
          <div className="ml-auto">
          </div>
        </div>

        {/* Only the invoice in the action slot. "Send to diary" used to sit
            alongside it, which put a client-facing action in the middle of the
            private side of the project, next to somebody's rate and their own
            questions. It belongs with the client page and now lives there. */}
        <RecordHeader
          title={project.title}
          meta={project.client}
          below={clientLink}
          action={
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* The clock, where you actually are when you decide to start.
                  It was a full-width card two bands down, which spent a
                  whole row of the page on a control pressed twice a day and
                  pushed the board below the fold. */}
              <TimerButton
                projectId={project.id}
                running={time.running}
                setUp={Boolean(time.mode && time.mode !== "OFF")}
                onSetUp={() => setSettingUpTimer(true)}
              />
              {/* The primary, and the only filled button on the row. Through
                  formatMoney rather than pasting a symbol in front of a
                  toLocaleString, which is how this one total kept printing
                  €650 while every other figure in the app had moved the euro
                  to the back. */}
              <Button data-guide="invoice" onClick={() => router.push(`/track/${project.id}/invoice`)}>
                {t.track.generateInvoice}, {formatMoney(project.price, project.currency, locale)}
              </Button>
            </div>
          }
        />

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

        {/* Where the hours went, above the schedule: what a project has cost
            so far is a more immediate question than when the next thing is
            due, and it is the one nothing in the app could answer. */}
        {/* Side by side. Both are glances: how long is left, and what lands
            next. Stacked, they were two full-width bands between the numbers
            and the board, and the board is what somebody came here for. */}
        {/* Stretch rather than start: the two cards sat at their own natural
            heights, so the schedule stood a good deal taller than what is
            coming up and the row read as one card with something tacked on
            beside it. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 items-stretch">
        {!scheduled ? (
          <SchedulePrompt projectId={project.id} />
        ) : (
          <Card className="h-full flex flex-col justify-center">
            {/* No "Timeline" heading and no date range up here. A line with dots
                on it is self-evidently a timeline, and the bar already states
                both dates at its right-hand end, so the header was a label and a
                duplicate above the thing they described. Reschedule is the only
                part that had to stay, and it now sits on the count's line
                inside the bar rather than on a row of its own. */}
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
              action={
                <button
                  type="button"
                  onClick={() => setRescheduling((r) => !r)}
                  className="text-caption font-semibold text-link bg-none border-none cursor-pointer p-0 tap"
                >
                  {rescheduling ? t.common.cancel : t.track.reschedule}
                </button>
              }
              markers={project.deliverables
                .filter((d) => d.dueAt)
                .map((d) => ({
                  id: d.id,
                  name: d.name,
                  dueAt: new Date(d.dueAt as string),
                  done: d.done,
                  doneAt: d.doneAt ? new Date(d.doneAt) : null,
                }))}
            />
          </Card>
        )}

        <BreakdownSuggestion
          projectId={project.id}
          pending={project.deliverables.filter((d) => !d.brokenDown).length}
          total={project.deliverables.length}
        />

        <ComingUp deadlines={deadlines} onSelect={setOpenId} />
        </div>

        <ActionError error={actionError} />

        <TimeSetUp
          projectId={project.id}
          open={settingUpTimer}
          onClose={() => setSettingUpTimer(false)}
          current={time.mode}
        />

        <Card>
          <div className="flex items-center gap-3 flex-wrap">
            <Label>{t.track.deliverables}</Label>
            {/* Two ways to read the same work. The board answers "what am I
                doing now"; the list answers "what did we agree", which is the
                shape of the quote rather than the shape of a day. The board
                is the default because once a project is running, the day is
                the question being asked. */}
            {allSteps.length > 0 && (
              <div className="ml-auto flex gap-1.5">
                <Chip active={view === "board"} onClick={() => setView("board")}>
                  {t.track.viewBoard}
                </Chip>
                <Chip active={view === "timeline"} onClick={() => setView("timeline")}>
                  {t.track.viewTimeline}
                </Chip>
                {project.plannedAt && !replanning && (
                  <button
                    type="button"
                    onClick={() => setReplanning(true)}
                    className="text-meta font-semibold text-slate bg-none border-none cursor-pointer px-1 tap"
                  >
                    {t.track.replan}
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Nothing to look at until the shape is settled, so ask for it
              rather than showing an empty grid and a pile of unplaced pills.
              After that it stays reachable. See lib/project-plan. */}
          {(!project.plannedAt || replanning) && allSteps.length > 0 ? (
            <div className="mt-3">
              <PlanSetup
                projectId={project.id}
                deliverables={project.deliverables.map((d) => ({ id: d.id, name: d.name }))}
                startDate={project.startDate}
                dueDate={project.dueDate}
                onClose={project.plannedAt ? () => setReplanning(false) : undefined}
              />
            </div>
          ) : view === "board" && allSteps.length > 0 ? (
            <div className="mt-3">
              <Board
                steps={allSteps}
                deliverables={project.deliverables.map((d) => ({ id: d.id, name: d.name }))}
                projectId={project.id}
                runningStepId={time.running?.stepId ?? null}
                canTrack={Boolean(time.mode && time.mode !== "OFF")}
              />
            </div>
          ) : view === "timeline" && allSteps.length > 0 ? (
            <div className="mt-3">
              <Timeline
                projectId={project.id}
                tasks={project.deliverables.flatMap((d) =>
                  d.steps.map((step) => ({
                    id: step.id,
                    name: step.name,
                    deliverableId: d.id,
                    estimateHours: step.estimateHours,
                    order: step.order ?? 0,
                    done: step.done,
                    plannedStart: step.plannedStart ?? null,
                    plannedEnd: step.plannedEnd ?? null,
                  }))
                )}
                deliverables={project.deliverables.map((d) => ({ id: d.id, name: d.name }))}
                startDate={project.startDate}
                dueDate={project.dueDate}
              />
            </div>
          ) : project.deliverables.length === 0 ? (
            <div className="text-text-muted text-small mt-1">{t.track.noDeliverables}</div>
          ) : quotedMilestones.length > 0 ? (
            /* Grouped under the milestone they were quoted in, so the list on
               screen matches the document the client signed. Read-only: the
               grouping is part of what was agreed, so there is nothing to drag
               and nothing to pick. */
            <div className="mt-1 flex flex-col gap-1">
              {quotedMilestones.map((ms) => {
                const inIt = project.deliverables.filter((d) => d.milestoneId === ms.id);
                if (inIt.length === 0) return null;
                const doneCount = inIt.filter((d) => d.done).length;
                const complete = doneCount === inIt.length;

                return (
                  <div key={ms.id} className="border-t border-line first:border-t-0 pt-3 first:pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-3 mb-1">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span
                          className={`font-body font-bold text-caption uppercase tracking-wide ${
                            ms.invoicedAt ? "text-text-muted" : complete ? "text-success" : "text-slate"
                          }`}
                        >
                          {ms.name}
                        </span>
                        <span className="text-caption text-text-muted tabular-nums">
                          {doneCount}/{inIt.length}
                        </span>
                      </div>
                      <span className="font-body font-semibold text-caption text-ink tabular-nums shrink-0">
                        {currencySymbol(project.currency)}
                        {ms.amount.toLocaleString()}
                      </span>
                    </div>
                    {/* What closes it, which is usually the client's move and
                        the reason the next milestone cannot start yet. Worth
                        having in front of you when chasing. */}
                    {ms.gate && (
                      <div className="text-caption text-link mb-1.5">
                        {t.quote.milestoneEndsWith}: {ms.gate}
                      </div>
                    )}
                    {inIt.map((d) => (
                      <DeliverableItem
                        key={d.id}
                        deliverable={d}
                        projectId={project.id}
                        expanded={openId === d.id}
                        onToggleExpanded={() => setOpenId(openId === d.id ? null : d.id)}
                        onDone={noteDone}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-1">
              {project.deliverables.map((d) => (
                <DeliverableItem
                  key={d.id}
                  deliverable={d}
                  projectId={project.id}
                  expanded={openId === d.id}
                  onToggleExpanded={() => setOpenId(openId === d.id ? null : d.id)}
                  onDone={noteDone}
                />
              ))}
            </div>
          )}
          {/* Right after the work it is about. A bar pinned to the bottom of the
              window would be easier to notice and harder to connect to the box
              that was just ticked. */}
          <DiaryPrompt
            projectId={project.id}
            done={justDone}
            onDismiss={() => setJustDone([])}
          />

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

        {/* The week, the log and the calendar import. Below the board on
            purpose: this is the part you read rather than the part you press,
            and it was pushing the board off the screen from two bands up. */}
        <TimePanel
          projectId={project.id}
          quotedHours={project.hours}
          loggedSeconds={time.loggedSeconds}
          entries={time.entries}
          deliverables={project.deliverables.map((d) => ({ id: d.id, name: d.name }))}
          running={time.running}
          hasCalendar={time.hasCalendar}
          mode={time.mode}
        />

        <Card>
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="flex items-baseline justify-between w-full bg-none border-none cursor-pointer p-0"
          >
            <Label>{t.track.projectDetails}</Label>
            <span className="text-meta font-semibold text-link">
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
                  variant="danger"
                  icon={Trash2}
                  disabled={deleting}
                  onClick={() => setConfirming(true)}
                >
                  {t.track.deleteProject}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleDeleteProject}
        working={deleting}
        title={t.common.confirmDeleteProject}
        hint={t.common.confirmDeleteProjectHint}
        confirmLabel={t.common.confirmDeleteProjectAction}
      >
        <p className="text-small text-ink m-0 font-semibold text-pretty">{project.title}</p>
        <p className="text-caption text-text-muted mt-1 mb-0">{project.client}</p>
      </Confirm>
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
