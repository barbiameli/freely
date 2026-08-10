"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { breakDownNextAction } from "@/actions/track";
import { useT } from "@/lib/i18n/context";

/**
 * Breaks the project's deliverables into steps as soon as it lands in Track.
 *
 * A button per deliverable meant the tracker arrived as a list of things the
 * client bought rather than a list of work, and someone had to press seven
 * buttons to get anything usable. This just does it.
 *
 * One deliverable per request: seven model calls inside the send-to-track
 * redirect would hang for a minute and risk the function timeout, and asking
 * for all seven in one call gives seven shallow answers. Looping here means
 * each one is done properly and the page fills in as it goes.
 */
export function AutoBreakdown({
  projectId,
  pending,
  total,
}: {
  projectId: string;
  /** How many still need doing when the page rendered. */
  pending: number;
  total: number;
}) {
  const t = useT();
  const router = useRouter();
  const [remaining, setRemaining] = useState(pending);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [stopped, setStopped] = useState(false);
  // Strict mode mounts effects twice in development, and each run is a real
  // model call, so the loop is guarded rather than left to run twice.
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;

    // A failure part way through is worth surfacing, but the deliverables
    // already done stay done, so stopping is not losing anything.
    for (;;) {
      const result = await breakDownNextAction(projectId);
      if (!result.ok) {
        setError(result.error);
        break;
      }
      setRemaining(result.data.remaining);
      setCurrent(result.data.name);
      if (result.data.remaining === 0) break;
    }

    running.current = false;
    setCurrent(null);
    router.refresh();
  }, [projectId, router]);

  useEffect(() => {
    if (pending > 0 && !stopped) void run();
    // Only ever kicked off by the initial pending count: re-running on every
    // refresh would loop forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pending === 0 || stopped) return null;

  const done = total - remaining;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-white border border-line rounded-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={13} className="text-violet shrink-0 animate-spin-slow" />
          <span className="font-body font-semibold text-small text-ink">
            {remaining === 0 ? t.track.allBrokenDown : t.track.workingOutSteps}
          </span>
          <span className="text-meta text-text-muted shrink-0">
            {done} of {total}
          </span>
        </div>
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => {
              setStopped(true);
              router.refresh();
            }}
            className="flex items-center gap-1 text-meta text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 shrink-0"
          >
            <X size={11} /> {t.quote.stop}
          </button>
        )}
      </div>

      <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
        <div
          className="h-full bg-violet rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {current && (
        <div className="text-meta text-text-muted mt-2 truncate">{t.track.lastDone}: {current}</div>
      )}
      {error && <div className="text-overdue text-meta mt-2">{error}</div>}
    </div>
  );
}
