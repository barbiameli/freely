import { ReactNode } from "react";

/**
 * A section header.
 *
 * Deliberately the darkest and heaviest text in a card. Headers, captions and
 * the required/optional note were all landing at a similar weight and colour,
 * which left every card reading as one flat block. The order is now header
 * (ink, semibold), caption (muted), then the required note (muted, smaller).
 */
export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="font-label text-small font-semibold tracking-wide text-ink mb-2.5 uppercase">
      {children}
    </div>
  );
}
