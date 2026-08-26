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
    <div className="font-label text-small font-semibold tracking-wide text-ink mb-1.5 uppercase">
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

/**
 * A section heading and the line that explains it.
 *
 * These two were written out together in fifteen places, and the gap
 * underneath the hint had drifted to eight different values: mb-1, mb-2,
 * mb-2.5, mb-3, mb-4, mb-0, and two variants with text-pretty. Nobody chose
 * those differences. They are what happens when a pattern is copied from
 * whichever screen was open rather than imported.
 *
 * The result was that two cards doing the same job sat differently on the
 * page, which reads as carelessness even when nobody can say why.
 *
 * `action` is for the button that sometimes sits beside a heading, which was
 * the other half of the drift: some cards wrapped the pair in a flex row and
 * some did not.
 */
export function CardHeader({
  title,
  hint,
  action,
}: {
  title: ReactNode;
  hint?: ReactNode;
  /** A control belonging to the section, aligned with the heading. */
  action?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Label>{title}</Label>
          {hint && <p className="text-caption text-text-muted mt-0 mb-0 text-pretty">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
