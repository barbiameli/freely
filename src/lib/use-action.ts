"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Running a server action with a pending state and a visible failure.
 *
 * Nearly every action call in the app was written as `await someAction(...)`
 * with the result thrown away, so a failure did nothing at all: the click
 * appeared to work, the change did not happen, and the person had no way to
 * know. Actions return `{ ok: false, error }` rather than throwing, so there
 * was nothing to catch either.
 *
 * This runs one, keeps a pending flag while it is in flight, stores the error
 * if it fails, and refreshes on success. Anything using it gets a disabled
 * state and an error message for free.
 */
export interface ActionOutcome<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(
    async <T>(
      action: () => Promise<Result<T>>,
      options: {
        /** Runs only when the action succeeded. */
        onSuccess?: (data: T) => void;
        /** Skips the router refresh, for actions that redirect themselves. */
        skipRefresh?: boolean;
        /** Shown instead of the action's own message. */
        errorMessage?: string;
      } = {}
    ): Promise<T | null> => {
      setPending(true);
      setError("");
      try {
        const result = await action();
        if (!result.ok) {
          setError(options.errorMessage ?? result.error);
          return null;
        }
        options.onSuccess?.(result.data);
        if (!options.skipRefresh) router.refresh();
        return result.data;
      } catch (err) {
        // Actions that redirect signal it by throwing, which is success.
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("NEXT_REDIRECT")) return null;
        console.error("[useAction] failed", err);
        setError(options.errorMessage ?? "That didn't work. Try again.");
        return null;
      } finally {
        setPending(false);
      }
    },
    [router]
  );

  return { run, pending, error, setError, clearError: () => setError("") };
}
