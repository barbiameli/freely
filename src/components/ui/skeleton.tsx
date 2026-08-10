/**
 * Placeholder shapes shown while a page loads.
 *
 * There were no loading states at all: every navigation showed the previous
 * page until the server replied, which on a slow connection reads as a dead
 * click. A rough outline of what is coming is more useful than a spinner,
 * because the layout does not jump when the real content lands.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={`bg-line/70 rounded animate-pulse ${className ?? ""}`} />;
}

/** A card-shaped placeholder, matching the app's usual block. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white border border-line rounded-card p-5">
      <Skeleton className="h-3 w-24 mb-4" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

/** The shape most pages in the app share: a title, a row of stats, some
 * cards. Close enough that the swap to real content is not a jolt. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5 md:gap-7" role="status" aria-label="Loading">
      <div>
        <Skeleton className="h-8 w-64 mb-3" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-[130px] bg-white border border-line rounded-card p-4">
            <Skeleton className="h-2.5 w-16 mb-2.5" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <SkeletonCard lines={4} />
      <SkeletonCard lines={2} />
      <span className="sr-only">Loading</span>
    </div>
  );
}
