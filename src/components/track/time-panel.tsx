"use client";

import { useEffect, useState } from "react";
import { Play, Square, Plus, CalendarDays, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/label";
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
import type { WeekEntry } from "@/lib/time-week";
import { TimeSetUp } from "@/components/track/time-set-up";
import {
  addTimeAction,
  importCalendarTimeAction,
  startTimerAction,
  stopTimerAction,
} from "@/actions/time";

/**
 * What an action here answers with.
 *
 * Named rather than written inline: the generic reads as a JSX tag to the
 * guard that scans this file for hardcoded copy, and a false positive there is
 * a test somebody learns to ignore.
 */
type Promised = Promise<{ ok: boolean; error?: string }>;

/**
 * Where the hours on this project went.
 *
 * Two ways in, because the two habits are different people. A timer for
 * somebody who works in sessions and wants the exact number, and a box for
 * everyone else, typed in from memory at the end of the day, which is how
 * most time actually gets recorded whatever a tool intends.
 *
 * The calendar import is the third: most freelancers already block their week
 * there, and asking them to also start a timer is asking for the same work
 * twice.
 *
 * The estimate line is the point of all of it. A project over by a fifth is a
 * project; the same overrun on four in a row is a pricing habit, and it is the
 * only thing here that changes what somebody charges next time.
 */
export function TimePanel({
  projectId,
  quotedHours,
  loggedSeconds,
  running,
  hasCalendar,
  mode,
  entries,
  deliverables,
}: {
  projectId: string;
  /** What the quote estimated. Zero on a fixed-price job with no hours. */
  quotedHours: number;
  loggedSeconds: number;
  /** Everything logged on this project, for the week view and the log. */
  entries: WeekEntry[];
  /** For saying what a stretch was spent on without typing it. */
  deliverables: { id: string; name: string }[];
  /** The running timer, when it belongs to this project. */
  running: { startedAt: string } | null;
  hasCalendar: boolean;
  /** What tracking is for here, or null while nobody has said. */
  mode: TimeMode | null;
}) {
  const t = useT();
  const [setUp, setSetUp] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");
  const [added, setAdded] = useState<number | null>(null);

  /**
   * Ticks every second while a timer runs.
   *
   * A number that changes once a minute looks stuck, and the point of a live
   * clock is that it is visibly moving. Off entirely when nothing is running,
   * so an idle project page is not re-rendering once a second forever.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const liveSeconds = running ? secondsBetween(running.startedAt, new Date(now)) : 0;
  const totalSeconds = loggedSeconds + liveSeconds;
  const total = Math.round(totalSeconds / 60);
  const accuracy = accuracyOf(quotedHours, total);
  const past = thresholdReached(quotedHours, total);
  /** Nobody has said what tracking is for here yet. */
  const notSetUp = !mode || mode === "OFF";

  async function run(key: string, fn: () => Promised) {
    setError("");
    setWorking(key);
    const result = await fn();
    setWorking("");
    if (!result.ok && result.error) setError(result.error);
  }

  /**
   * Nothing until somebody has said what this is for.
   *
   * A timer on every project is a tool asserting that this is how you work.
   * The question is asked once, on the engagement, because the answer is about
   * this piece of work rather than about the person.
   *
   * Below the hooks rather than above them: an early return before a useState
   * changes the hook order between renders, which React will not have.
   */
  if (notSetUp) {
    return (
      <>
        <Card tone="quiet">
          <CardHeader title={<>{t.track.timeTitle}</>} hint={<>{t.track.timeSetUpHint}</>} />
          <Button variant="outline" icon={Timer} onClick={() => setSetUp(true)}>
            {t.track.timeSetUp}
          </Button>
        </Card>
        <TimeSetUp projectId={projectId} open={setUp} onClose={() => setSetUp(false)} />
      </>
    );
  }

  return (
    <Card>
      <CardHeader title={<>{t.track.timeTitle}</>} hint={<>{t.track.timeHint}</>} />

      <div className="flex items-baseline gap-3 flex-wrap">
        {/* The running clock reads as a clock, seconds and all. A finished
            total reads as a length, because "2h 15m 40s" is a stopwatch
            reading nobody asked for. */}
        <div
          className={`font-display italic text-[28px] leading-none ${
            running ? "text-violet tabular-nums" : "text-ink"
          }`}
        >
          {running ? sayClock(totalSeconds) : sayDuration(totalSeconds)}
        </div>
        {quotedHours > 0 && (
          <div className="text-caption text-slate">
            {t.track.timeOfQuoted.replace("{hours}", String(quotedHours))}
          </div>
        )}
      </div>

      {/* The promise an hourly quote makes to the client, kept. */}
      {past && accuracy && (
        <p
          className={`text-caption mt-2 mb-0 max-w-prose text-pretty ${
            accuracy.percent > 0 ? "text-overdue font-semibold" : "text-slate"
          }`}
        >
          {accuracy.percent > 0
            ? t.track.timeOver.replace("{percent}", String(accuracy.percent))
            : t.track.timeNearEstimate}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        {running ? (
          <Button
            variant="danger"
            icon={Square}
            loading={working === "stop"}
            onClick={() => void run("stop", () => stopTimerAction())}
          >
            {t.track.timeStop.replace("{length}", sayClock(liveSeconds))}
          </Button>
        ) : (
          <Button
            icon={Play}
            loading={working === "start"}
            onClick={() => void run("start", () => startTimerAction(projectId))}
          >
            {t.track.timeStart}
          </Button>
        )}

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
      </div>

      {added !== null && (
        <p className="text-caption text-slate mt-2 mb-0">
          {added > 0
            ? t.track.timeImported.replace("{count}", String(added))
            : t.track.timeImportedNone}
        </p>
      )}

      {/* Typed in from memory, which is how most time gets recorded whatever
          a tool intends. Minutes, because "90" is quicker to type and harder
          to get wrong than "1.5". */}
      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-line">
        <input
          type="number"
          min={1}
          max={1440}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder={t.track.timeMinutes}
          className="w-[110px] bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
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
              });
              if (result.ok) setManual("");
              return result;
            })
          }
        >
          {t.track.timeAdd}
        </Button>
      </div>

      {/* The week, under the controls. A list of durations is a receipt; a
          week is a shape, and it shows the day nothing happened. */}
      {entries.length > 0 && (
        <div className="mt-5 pt-5 border-t border-line">
          <TimeWeek entries={entries} deliverables={deliverables} />
        </div>
      )}

      <ActionError error={error} className="mt-3" />
    </Card>
  );
}
