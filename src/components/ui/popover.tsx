"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "@/lib/clsx";

/**
 * A panel that belongs to the button that opened it.
 *
 * Everything that opens from a button in Freely goes through this, for one
 * reason: what opened used to appear wherever it happened to sit in the
 * document. Pressing "Add project" at the top of Track showed its panel below
 * the stat cards, half a screen away, so the thing you had just summoned looked
 * like a section of the page that had always been there and nothing connected
 * it to the press.
 *
 * Proximity is the whole job. A panel touching the control that opened it is
 * read as its consequence; the same panel forty pixels lower is read as
 * furniture. Same material as every other floating surface in the app, so the
 * second signal agrees with the first.
 *
 * It handles the things a panel has to handle and callers should not repeat:
 * clicking away closes it, escape closes it, and the trigger keeps its own
 * aria-expanded so a screen reader is told the same story the eye is.
 */
export function Popover({
  trigger,
  children,
  /** Hangs off the right edge, for a control near the right of the screen. */
  align = "left",
  /** Wider than the default 320, for a list with two columns of content. */
  width = 320,
  label,
}: {
  /** Renders the button. `open` is for aria-expanded and any visual state. */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  align?: "left" | "right";
  width?: number;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onAway(event: MouseEvent) {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onAway);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onAway);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}

      {open && (
        <div
          role="dialog"
          aria-label={label}
          style={{ width }}
          className={clsx(
            "absolute top-[calc(100%+8px)] z-50 max-w-[calc(100vw-32px)] bg-white border border-line rounded-card shadow-dialog overflow-hidden animate-dialog-in motion-reduce:animate-none",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}

/** A heading inside a popover, so every panel opens the same way. */
export function PopoverHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-4 py-3 border-b border-line">
      <div className="font-body font-bold text-small text-ink">{title}</div>
      {hint && <p className="text-caption text-text-muted mt-0.5 mb-0 text-pretty">{hint}</p>}
    </div>
  );
}

/**
 * The scrolling part.
 *
 * Capped at roughly five rows. Five is enough to recognise what you are looking
 * for, and a panel taller than that stops reading as attached to the button and
 * starts reading as a page.
 */
export function PopoverList({ children }: { children: ReactNode }) {
  return <div className="max-h-[260px] overflow-y-auto">{children}</div>;
}
