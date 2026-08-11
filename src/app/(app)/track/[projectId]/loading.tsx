"use client";

import { useT } from "@/lib/i18n/context";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** The tracker has a distinctive shape (sidebar, stat row, timeline, list),
 * so it gets its own outline rather than the generic one. */
export default function Loading() {
  const t = useT();

  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:gap-6" role="status" aria-label={t.common.loading}>
      <div className="w-full lg:w-[200px] lg:shrink-0 bg-white border border-line rounded-card p-5">
        <Skeleton className="h-2.5 w-20 mb-3" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-5 flex-1 min-w-0">
        <Skeleton className="h-8 w-72" />
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 min-w-[130px] bg-white border border-line rounded-card p-4"
            >
              <Skeleton className="h-2.5 w-12 mb-2.5" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
        <SkeletonCard lines={2} />
        <SkeletonCard lines={5} />
      </div>
      <span className="sr-only">{t.common.loading}</span>
    </div>
  );
}
