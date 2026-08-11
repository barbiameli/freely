"use client";

import { useT } from "@/lib/i18n/context";
import { Skeleton } from "@/components/ui/skeleton";

/** A published quote is often the first thing a client sees, so the wait
 * should not be a blank white page. */
export default function Loading() {
  const t = useT();

  return (
    <div className="min-h-screen bg-paper py-10 px-5" role="status" aria-label={t.common.loading}>
      <div className="max-w-[720px] mx-auto flex flex-col gap-5">
        <div className="bg-ink rounded-card p-8">
          <Skeleton className="h-2.5 w-20 mb-4 bg-white/20" />
          <Skeleton className="h-7 w-2/3 mb-3 bg-white/25" />
          <Skeleton className="h-3 w-32 bg-white/15" />
        </div>
        <div className="bg-white rounded-card p-6 flex flex-col gap-2.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
      <span className="sr-only">{t.common.loading}</span>
    </div>
  );
}
