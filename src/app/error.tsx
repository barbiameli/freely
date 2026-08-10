"use client";

import { useEffect } from "react";

/** The outermost failure, for anything outside the app layout: the marketing
 * page, a public quote, the auth screens. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root] page failed to render", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display italic text-[30px] text-coral m-0">
        Something went wrong.
      </h1>
      <p className="text-slate text-body mt-2 max-w-[400px]">
        This one is on us. Try again in a moment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="font-body font-bold text-sm text-white bg-violet rounded-lg px-4 py-2.5 mt-5 border-none cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}
