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
 *
 * It returns an outcome rather than the data, and that is the whole point of
 * the shape. It used to return `T | null`, which reads fine until the action
 * has nothing to return: `{ ok: true, data: undefined }` came back as
 * `undefined`, every caller written as `if (result)` treated a success as a
 * failure, and three of them shipped that way. The plain-language toggle flipped
 * itself back after saving, the diary prompt never dismissed so people clicked
 * again and got duplicate entries on a client's page, and the "did you land
 * this?" card never advanced.
 *
 * One `ok` to check, and success with no data is no longer spelled the same way
 * as failure.
 */
export interface ActionOutcome<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** What run() gives back. Check `ok`, never the data. */
export type Ran<T> = { ok: true; data: T } | { ok: false };

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
    ): Promise<Ran<T>> => {
      setPending(true);
      setError("");
      try {
        const result = await action();
        if (!result.ok) {
          setError(options.errorMessage ?? result.error);
          return { ok: false };
        }
        options.onSuccess?.(result.data);
        if (!options.skipRefresh) router.refresh();
        return { ok: true, data: result.data };
      } catch (err) {
        // Actions that redirect signal it by throwing, which is success. The
        // navigation is already happening, so there is nothing for the caller
        // to do either way.
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("NEXT_REDIRECT")) return { ok: false };
        console.error("[useAction] failed", err);
        setError(options.errorMessage ?? "That didn't work. Try again.");
        return { ok: false };
      } finally {
        setPending(false);
      }
    },
    [router]
  );

  return { run, pending, error, setError, clearError: () => setError("") };
}
