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

/**
 * The smaller label, for a field or a group inside a card.
 *
 * The same eight utility classes were written out in fourteen places, with the
 * margin underneath drifting between none, mb-1, mb-2 and mb-2.5 depending on
 * which screen it was copied from. Nobody chose those differences; they are
 * what happens when a pattern is pasted rather than imported.
 *
 * A Label above a SubLabel is the hierarchy: section, then the things in it.
 */
export function SubLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  /** For the rare case that needs a different gap or an icon alongside. */
  className?: string;
}) {
  return (
    <div
      className={`font-body text-caption font-bold text-slate uppercase tracking-wide mb-2 ${className}`}
    >
      {children}
    </div>
  );
}
