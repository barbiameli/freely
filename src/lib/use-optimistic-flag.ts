"use client";

import { useEffect, useState } from "react";

/**
 * A checkbox that moves when you click it, not when the server agrees.
 *
 * Ticking a deliverable was: click, nothing, wait for the server action, wait
 * for router.refresh() to re-render the page from the server, and only then see
 * the tick. On a good connection that is a few hundred milliseconds of a
 * checkbox that looks broken; on a bad one it is long enough to click again.
 *
 * The state a tick represents is the freelancer's own knowledge, and they are
 * not asking permission. So it flips immediately and the write happens behind
 * it. The refresh still runs, because the counters and progress bars elsewhere
 * on the page are derived from the same data, but by then the box already
 * moved and nobody is watching.
 *
 * If the write fails, the override is dropped and the box goes back to what
 * the server says, which is the honest outcome: showing a tick for something
 * that was never saved is worse than a slow tick.
 */
export function useOptimisticFlag(
  /** What the server currently says. */
  actual: boolean,
  /** Performs the write. Returning ok:false reverts. */
  commit: (next: boolean) => Promise<{ ok: boolean } | void>
): readonly [boolean, () => void, boolean] {
  const [override, setOverride] = useState<boolean | null>(null);
  const [inFlight, setInFlight] = useState(false);

  const shown = override ?? actual;

  // Once the server agrees, stop overriding it. Keeping the override past that
  // point would mean a later change from anywhere else, a teammate, another
  // tab, was invisible here.
  useEffect(() => {
    setOverride((current) => (current === null || current === actual ? null : current));
  }, [actual]);

  function toggle() {
    const next = !shown;
    setOverride(next);
    setInFlight(true);
    void Promise.resolve(commit(next))
      .then((result) => {
        if (result && result.ok === false) setOverride(null);
      })
      .catch(() => setOverride(null))
      .finally(() => setInFlight(false));
  }

  return [shown, toggle, inFlight] as const;
}
