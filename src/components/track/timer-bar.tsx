"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Square } from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { sayClock, secondsBetween } from "@/lib/time-tracking";
import { stopTimerAction } from "@/actions/time";

/** What the shell was handed when the page loaded. */
export interface RunningTimer {
  id: string;
  projectId: string;
  projectTitle: string;
  note: string;
  startedAt: string;
}

/**
 * The event a panel fires when it starts or stops a clock.
 *
 * The bar lives in the app shell, which does not re-render when somebody
 * presses start three levels down. Waiting for a navigation would mean a timer
 * that only appears once you leave the page you started it on, which is the
 * opposite of the point.
 */
export const TIMER_CHANGED = "freely:timer";

export function announceTimerChange(running: RunningTimer | null): void {
  window.dispatchEvent(new CustomEvent(TIMER_CHANGED, { detail: running }));
}

/**
 * The running clock, wherever you are.
 *
 * A timer that is only visible on the project it belongs to is a timer that
 * runs through lunch, an afternoon on a different client, and occasionally a
 * night. It follows you instead: what is running, on what, for how long, and
 * one press to stop it.
 *
 * Nothing when nothing is running, so it costs no space in the ordinary case.
 */
export function TimerBar({ initial }: { initial: RunningTimer | null }) {
  const t = useT();
  const router = useRouter();
  const [running, setRunning] = useState<RunningTimer | null>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [stopping, setStopping] = useState(false);

  // The server's answer wins on navigation.
  useEffect(() => setRunning(initial), [initial]);

  useEffect(() => {
    function onChange(event: Event) {
      setRunning((event as CustomEvent<RunningTimer | null>).detail ?? null);
    }
    window.addEventListener(TIMER_CHANGED, onChange);
    return () => window.removeEventListener(TIMER_CHANGED, onChange);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  if (!running) return null;

  const seconds = secondsBetween(running.startedAt, new Date(now));

  async function stop() {
    setStopping(true);
    await stopTimerAction();
    setStopping(false);
    setRunning(null);
    router.refresh();
  }

  return (
    <div className="sticky top-0 z-30 -mx-5 md:-mx-8 mb-4 px-5 md:px-8 py-2.5 bg-violet text-white flex items-center gap-3">
      <span className="font-body font-bold text-small tabular-nums shrink-0">
        {sayClock(seconds)}
      </span>
      <Link
        href={`/track/${running.projectId}`}
        className="min-w-0 flex-1 text-white/90 no-underline truncate text-small tap-row"
      >
        {running.note || running.projectTitle || t.track.timeTitle}
      </Link>
      <button
        type="button"
        disabled={stopping}
        onClick={() => void stop()}
        aria-label={t.track.stop}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 border-none text-white px-3 py-1.5 cursor-pointer tap disabled:opacity-60"
      >
        <Square size={12} />
        <span className="font-body font-semibold text-caption">{t.track.stop}</span>
      </button>
    </div>
  );
}
