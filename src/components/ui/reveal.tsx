import type { ReactNode } from "react";
import clsx from "@/lib/clsx";

/**
 * A panel that appeared because of something you chose.
 *
 * These were styled as more form: a top border, the same background, the same
 * labels, sitting directly under the control that opened them. So pressing "not
 * sure what to charge" produced four new fields that looked exactly like the
 * four fields already there, and the only sign that anything had happened was
 * that the page got longer. Somebody scrolling back up a minute later has no
 * way to tell which parts they asked for and which were always there.
 *
 * The treatment says three things at once, which is the point of having one
 * rather than three: a tint the surrounding form does not use, a rule down the
 * left where the choice was made, and its own heading. Together they read as a
 * consequence. Alone, each one reads as decoration.
 *
 * Not a Card, and deliberately so. A Card is a peer of the other cards on the
 * page; this is subordinate to the control above it and has to look subordinate
 * or it competes with the thing that opened it.
 */
export function Reveal({
  title,
  hint,
  tone = "violet",
  children,
  className,
}: {
  /** What this panel is for. Always said: an unlabelled panel is a surprise. */
  title?: ReactNode;
  hint?: ReactNode;
  /**
   * Violet is the app's "Freely is doing something" colour and covers almost
   * every case. Coral is for a branch that changes what the client receives,
   * where the same weight would understate it.
   */
  tone?: "violet" | "coral";
  children: ReactNode;
  className?: string;
}) {
  const tint = tone === "coral" ? "bg-coral-tint border-coral" : "bg-violet-tint border-violet";

  return (
    <div
      className={clsx(
        "mt-3 rounded-card border-l-[3px] px-4 py-3.5 animate-fade-in motion-reduce:animate-none",
        tint,
        className
      )}
    >
      {title && (
        <div className="font-body font-bold text-caption uppercase tracking-[0.08em] text-slate">
          {title}
        </div>
      )}
      {hint && <p className="text-caption text-slate mt-1 mb-0 text-pretty">{hint}</p>}
      <div className={title || hint ? "mt-2.5" : ""}>{children}</div>
    </div>
  );
}
