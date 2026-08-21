"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { breakDownNextAction } from "@/actions/track";
import { useT } from "@/lib/i18n/context";

/**
 * Offers to break the project's deliverables into steps, and does it on a click.
 *
 * This used to run by itself the moment a project landed in Track: arriving at a
 * tracker that had already worked out the steps felt like the app being useful
 * without being asked. What it actually did was spend a model call per
 * deliverable on every project, including the ones opened once and abandoned,
 * and including the freelancers who write their own steps and then had to
 * delete a set they never wanted.
 *
 * So the loop is the same, it just starts from a button. Somebody who wants the
 * steps is one click away, and nobody pays for the ones nobody reads.
 *
 * Still one deliverable per request. Six in a single call gives six shallow
 * answers, and six calls inside one request risks the function timeout, so the
 * loop runs here and the page fills in a piece at a time.
 */
export function BreakdownOffer({
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
  const [started, setStarted] = useState(false);
  const [stopped, setStopped] = useState(false);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setStarted(true);

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

  if (pending === 0 || stopped) return null;

  const done = total - remaining;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  if (!started) {
    return (
      <div className="bg-white border border-line rounded-card px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-violet shrink-0" />
            <span className="font-body font-semibold text-small text-ink">
              {t.track.breakDownOffer}
            </span>
            <span className="text-meta text-text-muted shrink-0">
              {pending} {t.track.breakDownCount}
            </span>
          </div>
          <p className="text-meta text-text-muted mt-1 m-0 text-pretty">{t.track.breakDownWhy}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setStopped(true)}
            className="text-meta text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 tap"
          >
            {t.common.notNow}
          </button>
          <button
            type="button"
            onClick={() => void run()}
            data-guide="breakdown"
            className="font-body font-semibold text-meta text-white bg-violet border-none rounded-full px-3.5 py-2 cursor-pointer tap"
          >
            {t.track.breakDownOffer}
          </button>
        </div>
      </div>
    );
  }

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
            className="flex items-center gap-1 text-meta text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 tap shrink-0"
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
        <div className="text-meta text-text-muted mt-2 truncate">
          {t.track.lastDone}: {current}
        </div>
      )}
      {error && <div className="text-overdue text-meta mt-2">{error}</div>}
    </div>
  );
}
