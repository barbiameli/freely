"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n/context";

/**
 * When a page fails to render.
 *
 * Without this, a server error showed Next's own error screen, which is a
 * stack trace in development and a blank apology in production. This says
 * what happened in a sentence and offers the two things worth trying.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    // The digest is what ties this to a line in the server logs.
    console.error("[app] page failed to render", error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4 max-w-[520px]">
      <div>
        <h1 className="font-display italic text-[28px] text-coral m-0">
          {t.errors.pageTitle}
        </h1>
        <p className="text-slate text-body mt-2 leading-relaxed">
          {t.errors.pageBody}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 font-body font-bold text-sm text-white bg-violet rounded-lg px-4 py-2.5 border-none cursor-pointer"
        >
          <RefreshCw size={13} /> {t.common.tryAgain}
        </button>
        <Link href="/quote" className="text-small font-semibold text-violet">
          {t.errors.goToQuote}
        </Link>
      </div>
      {error.digest && (
        <p className="text-meta text-text-muted m-0">
          {t.errors.reference}: {error.digest}
        </p>
      )}
    </div>
  );
}
