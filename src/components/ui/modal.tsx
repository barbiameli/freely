"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import clsx from "@/lib/clsx";

/**
 * The one overlay in the app.
 *
 * Before this there were three ways to interrupt somebody: a hand-built overlay
 * for sending to the diary, a row of tiny text links for deleting a draft, and
 * the browser's own confirm() for deleting a project or an account. The last of
 * those is the worst of the three, because the most destructive action in the
 * product was the one that looked least like Freely and gave the least
 * information about what was about to happen.
 *
 * So: one component. Anything that interrupts goes through it and they all look
 * the same, which is what makes an overlay readable. Somebody who has seen one
 * knows where the close is, knows the dark backdrop means the page behind is
 * waiting, and knows the button on the right is the one that does the thing.
 *
 * What it handles, so no caller has to:
 *
 * Escape closes it, because a person who wants out of a dialog presses escape
 * before they look for a button.
 *
 * The backdrop closes it, on the backdrop only. A click that started inside the
 * panel and ended outside it is a drag, not a dismissal, and closing on that
 * loses whatever they were typing.
 *
 * The page behind stops scrolling, and goes slightly out of focus. An overlay
 * over a sharp, moving page reads as a banner rather than as something waiting
 * for an answer.
 *
 * Focus moves into the panel on open. Without it, a keyboard user's next tab
 * goes to whatever was behind the overlay.
 */
export function Modal({
  open,
  onClose,
  title,
  hint,
  children,
  footer,
  /** Wider, for a dialog holding a list rather than a sentence. */
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: string;
  children?: ReactNode;
  /** The actions. Laid out by the modal so every dialog puts them in one place. */
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    // Held and restored rather than set to "", so a page that was already
    // locked by something else does not get unlocked by this closing.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panel.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[3px] flex items-start sm:items-center justify-center p-4 overflow-y-auto animate-fade-in motion-reduce:animate-none"
      // Only a press that both started and ended on the backdrop is a dismissal.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "bg-white rounded-card shadow-dialog w-full my-auto outline-none animate-dialog-in motion-reduce:animate-none",
          wide ? "max-w-[560px]" : "max-w-[420px]"
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <div className="min-w-0">
            <div className="font-body font-bold text-body text-ink text-pretty">{title}</div>
            {hint && <p className="text-caption text-slate mt-0.5 mb-0 text-pretty">{hint}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={title}
            className="shrink-0 text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 tap"
          >
            <X size={16} />
          </button>
        </div>

        {children && <div className="px-5 py-4">{children}</div>}

        {footer && (
          // Actions on the right, and the same way round in every dialog: the
          // way out first, the thing that happens last.
          <div className="flex flex-wrap items-center justify-end gap-3 px-5 py-3.5 border-t border-line">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
