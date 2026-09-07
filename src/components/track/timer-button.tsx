"use client";

import { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { sayClock, secondsBetween } from "@/lib/time-tracking";
import { startTimerAction, stopTimerAction } from "@/actions/time";
import { announceTimerChange } from "@/components/track/timer-bar";

/**
 * Start the clock, from the top of the page.
 *
 * The tracker was a full-width card sitting between the project's numbers and
 * its schedule, spending a whole band of the page on a control that is pressed
 * twice a day. Everything above the board pushed the board below the fold, and
 * the board is the thing somebody came here to look at.
 *
 * So the timer is a button next to the one other thing you do from this
 * header, and the panel with the week and the log stays further down for when
 * you want to read it rather than use it.
 *
 * Coral, and it breathes once when you land on a project with nothing running.
 * A stopwatch nobody starts is the failure mode for this feature: it is the
 * one control here that has to ask for attention, and it stops asking the
 * moment it is running, which is when it has what it wanted.
 */
export function TimerButton({
  projectId,
  running,
  setUp,
  onSetUp,
}: {
  projectId: string;
  running: { startedAt: string; note?: string } | null;
  /** Whether this engagement has been told what the tracking is for. */
  setUp: boolean;
  /** Opens the one-time setup, when it has not been done. */
  onSetUp: () => void;
}) {
  const t = useT();
  const [working, setWorking] = useState(false);
  const [seconds, setSeconds] = useState(() =>
    running ? secondsBetween(running.startedAt, new Date()) : 0
  );

  useEffect(() => {
    if (!running) return;
    setSeconds(secondsBetween(running.startedAt, new Date()));
    const timer = window.setInterval(
      () => setSeconds(secondsBetween(running.startedAt, new Date())),
      1000
    );
    return () => window.clearInterval(timer);
  }, [running]);

  async function toggle() {
    if (!setUp) {
      onSetUp();
      return;
    }
    setWorking(true);
    if (running) {
      const result = await stopTimerAction();
      if (result.ok) announceTimerChange(null);
    } else {
      const result = await startTimerAction(projectId, "");
      if (result.ok) {
        announceTimerChange({
          id: result.data.id,
          projectId,
          projectTitle: "",
          note: "",
          startedAt: new Date().toISOString(),
        });
      }
    }
    setWorking(false);
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={working}
      aria-label={running ? t.track.stop : t.track.timeStart}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 border-none cursor-pointer font-body font-bold text-small tap disabled:opacity-60 ${
        running
          ? "bg-ink text-white"
          : // Breathes once on arrival, and only while nothing is running.
            "bg-coral text-white animate-pulse-once"
      }`}
    >
      {running ? <Square size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
      <span className="tabular-nums">{running ? sayClock(seconds) : t.track.timeStart}</span>
    </button>
  );
}
