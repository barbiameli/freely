"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Play, Plus, Square, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import { useT } from "@/lib/i18n/context";
import {
  accuracyOf,
  sayClock,
  sayDuration,
  secondsBetween,
  thresholdReached,
  type TimeMode,
} from "@/lib/time-tracking";
import { TimeWeek } from "@/components/track/time-week";
import { TimeSetUp } from "@/components/track/time-set-up";
import type { WeekEntry } from "@/lib/time-week";
import {
  addTimeAction,
  importCalendarTimeAction,
  startTimerAction,
  stopTimerAction,
} from "@/actions/time";
import { announceTimerChange } from "@/components/track/timer-bar";

/** What an action here answers with. Named so the generic is not read as JSX. */
type Promised = Promise<{ ok: boolean; error?: string }>;

/**
 * Time on this project, folded away until it is wanted.
 *
 * It was a card the height of the schedule, sitting open on every project
 * whether or not anybody tracked time, which is most projects. An optional
 * tool given permanent space is a tool that pushes the things people do use
 * further down the page.
 *
 * So it is one line, and it says the two things worth knowing without being
 * opened: how long this project has taken, and whether a clock is running. The
 * clock stays visible and stoppable while it is closed, because a timer you
 * have to go looking for is a timer that runs all night.
 *
 * The rest, borrowed from the tools people already use for this: describe the
 * work before starting it rather than after, one running timer, and the week
 * laid out so the shape of it is visible.
 */
export function TimePanel({
  projectId,
  quotedHours,
  loggedSeconds,
  entries,
  deliverables,
  running,
  hasCalendar,
  mode,
}: {
  projectId: string;
  /** What the quote estimated. Zero on a fixed-price job with no hours. */
  quotedHours: number;
  loggedSeconds: number;
  entries: WeekEntry[];
  deliverables: { id: string; name: string }[];
  running: { startedAt: string; note?: string } | null;
  hasCalendar: boolean;
  mode: TimeMode | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [setUp, setSetUp] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [added, setAdded] = useState<number | null>(null);
  /**
   * What you are about to work on.
   *
   * Asked before the timer starts rather than after it stops. Afterwards it is
   * a question about something already finished, and the honest answer by then
   * is often that nobody remembers, which is how a week of tracked time turns
   * into a column of durations against nothing.
   */
  const [what, setWhat] = useState("");

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const liveSeconds = running ? secondsBetween(running.startedAt, new Date(now)) : 0;
  const totalSeconds = loggedSeconds + liveSeconds;
  const accuracy = accuracyOf(quotedHours, Math.round(totalSeconds / 60));
  const past = thresholdReached(quotedHours, Math.round(totalSeconds / 60));
  const notSetUp = !mode || mode === "OFF";

  async function run(key: string, fn: () => Promised) {
    setError("");
    setWorking(key);
    const result = await fn();
    setWorking("");
    if (!result.ok && result.error) setError(result.error);
  }

  /** Nothing until somebody has said what this is for. */
  if (notSetUp) {
    return (
      <>
        <Card tone="quiet">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-body font-semibold text-small text-ink">{t.track.timeTitle}</div>
              <p className="text-caption text-slate mt-0.5 mb-0 text-pretty">
                {t.track.timeSetUpHint}
              </p>
            </div>
            <Button variant="outline" icon={Timer} onClick={() => setSetUp(true)}>
              {t.track.timeSetUp}
            </Button>
          </div>
        </Card>
        <TimeSetUp projectId={projectId} open={setUp} onClose={() => setSetUp(false)} />
      </>
    );
  }

  return (
    <>
      <Card className="p-0 overflow-hidden">
        {/* The line it is when closed. Both facts, and the stop button, without
            opening anything. */}
        <div className="flex items-center gap-3 px-5 py-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex items-center gap-2 min-w-0 flex-1 text-left bg-none border-none cursor-pointer p-0 tap-row"
          >
            {open ? (
              <ChevronDown size={14} className="text-text-muted shrink-0" />
            ) : (
              <ChevronRight size={14} className="text-text-muted shrink-0" />
            )}
            <span className="font-body font-semibold text-small text-ink">
              {t.track.timeTitle}
            </span>
            <span
              className={`font-body font-semibold text-small tabular-nums ${
                running ? "text-violet" : "text-slate"
              }`}
            >
              {running ? sayClock(totalSeconds) : sayDuration(totalSeconds)}
            </span>
            {quotedHours > 0 && !running && (
              <span className="text-caption text-text-muted truncate">
                {t.track.timeOfQuoted.replace("{hours}", String(quotedHours))}
              </span>
            )}
          </button>

          {/* Stoppable while closed: a timer you have to go looking for is a
              timer that runs all night. */}
          {running && (
            <Button
              variant="danger"
              icon={Square}
              loading={working === "stop"}
              onClick={() =>
                void run("stop", async () => {
                  const result = await stopTimerAction();
                  if (result.ok) announceTimerChange(null);
                  return result;
                })
              }
            >
              {t.track.stop}
            </Button>
          )}
        </div>

        {open && (
          <div className="px-5 pb-5 border-t border-line pt-4">
            {/* Describe it, then start it. */}
            {!running && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={what}
                  onChange={(e) => setWhat(e.target.value)}
                  placeholder={t.track.whatAreYouDoing}
                  className="flex-1 min-w-[180px] bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
                />
                <Button
                  icon={Play}
                  loading={working === "start"}
                  onClick={() =>
                    void run("start", async () => {
                      const description = what.trim();
                      const result = await startTimerAction(projectId, description);
                      if (result.ok) {
                        setWhat("");
                        // So the bar in the shell shows it without waiting for
                        // a navigation.
                        announceTimerChange({
                          id: result.data.id,
                          projectId,
                          projectTitle: "",
                          note: description,
                          startedAt: new Date().toISOString(),
                        });
                      }
                      return result;
                    })
                  }
                >
                  {t.track.timeStart}
                </Button>
              </div>
            )}

            {running && running.note && (
              <p className="text-small text-slate m-0">{running.note}</p>
            )}

            {past && accuracy && (
              <p
                className={`text-caption mt-3 mb-0 max-w-prose text-pretty ${
                  accuracy.percent > 0 ? "text-overdue font-semibold" : "text-slate"
                }`}
              >
                {accuracy.percent > 0
                  ? t.track.timeOver.replace("{percent}", String(accuracy.percent))
                  : t.track.timeNearEstimate}
              </p>
            )}

            {entries.length > 0 && (
              <div className="mt-5">
                <TimeWeek entries={entries} deliverables={deliverables} />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-line">
              <input
                type="number"
                min={1}
                max={1440}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder={t.track.timeMinutes}
                className="w-[104px] bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
              />
              <Button
                variant="outline"
                icon={Plus}
                loading={working === "add"}
                disabled={!manual.trim()}
                onClick={() =>
                  void run("add", async () => {
                    const result = await addTimeAction({
                      projectId,
                      minutes: Number(manual),
                      note: what.trim(),
                    });
                    if (result.ok) {
                      setManual("");
                      setWhat("");
                    }
                    return result;
                  })
                }
              >
                {t.track.timeAdd}
              </Button>

              {hasCalendar && (
                <Button
                  variant="outline"
                  icon={CalendarDays}
                  loading={working === "import"}
                  onClick={() =>
                    void run("import", async () => {
                      const result = await importCalendarTimeAction(projectId);
                      if (result.ok) setAdded(result.data.added);
                      return result;
                    })
                  }
                >
                  {t.track.timeFromCalendar}
                </Button>
              )}

              {/* Changeable, because the answer moves: a job tracked privately
                  becomes one the client is billed for. */}
              <button
                type="button"
                onClick={() => setSetUp(true)}
                className="ml-auto text-meta font-semibold text-slate bg-none border-none cursor-pointer p-0 tap"
              >
                {t.track.timeChangeUse}
              </button>
            </div>

            {added !== null && (
              <p className="text-caption text-slate mt-2 mb-0">
                {added > 0
                  ? t.track.timeImported.replace("{count}", String(added))
                  : t.track.timeImportedNone}
              </p>
            )}

            <ActionError error={error} className="mt-3" />
          </div>
        )}
      </Card>

      <TimeSetUp
        projectId={projectId}
        open={setUp}
        onClose={() => setSetUp(false)}
        current={mode}
      />
    </>
  );
}
