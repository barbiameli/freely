"use client";

import { usePathname } from "next/navigation";

/**
 * A page arriving rather than replacing the last one.
 *
 * Keyed on the path, so React discards the old subtree and the animation runs
 * again on every navigation. Without the key it plays once, on first load,
 * and never again, which is the trap this pattern usually falls into.
 *
 * 180ms and a four pixel rise. Deliberately at the bottom of what is
 * perceptible: this happens on every single navigation, and a transition
 * somebody notices twice is a transition they resent by the twentieth time.
 * Anything over about 200ms here is a delay, not a flourish.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-in flex flex-col gap-5 md:gap-6 flex-1 min-w-0">
      {children}
    </div>
  );
}
