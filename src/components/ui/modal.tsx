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
 * for an answer. Slightly: the page stays readable, because the whole point of
 * an overlay on top of your own work is that you can still see the work.
 *
 * A caller can hold one control above the blur by giving it a z-index over
 * this one, which is what the control that opened the dialog wants: blurring
 * the thing you just pressed loses the connection between the two.
 *
 * Focus moves into the panel on open. Without it, a keyboard user's next tab
 * goes to whatever was behind the overlay.
 *
 * On a phone it is a sheet rather than a box: full width, pinned to the bottom,
 * square along the bottom edge and rounded along the top. A centred 420px card
 * on a 390px screen is a card with 16px of backdrop around it, which reads as a
 * box that failed to fit, and its close sits at the top of the screen where the
 * thumb holding the phone cannot reach it. The sheet also caps its height and
 * scrolls inside itself, so a long list cannot push the actions off-screen.
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
  /**
   * No header of its own, and no padding around the content.
   *
   * For content that already carries its own heading and spacing, which is
   * what a popover's panel is. Without this a popover shown as a sheet on a
   * phone would arrive with two titles and two sets of padding.
   */
  bare,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint?: string;
  children?: ReactNode;
  /** The actions. Laid out by the modal so every dialog puts them in one place. */
  footer?: ReactNode;
  wide?: boolean;
  bare?: boolean;
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
      className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[1.5px] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in motion-reduce:animate-none"
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
          "relative bg-white shadow-dialog w-full outline-none animate-dialog-in motion-reduce:animate-none",
          "rounded-t-card sm:rounded-card",
          "max-h-[88vh] sm:max-h-none overflow-y-auto sm:overflow-visible sm:my-auto",
          "safe-bottom sm:pb-0",
          wide ? "sm:max-w-[560px]" : "sm:max-w-[420px]"
        )}
      >
        {bare ? (
          // The content brings its own heading, so this only adds the way out.
          <button
            type="button"
            onClick={onClose}
            aria-label={title}
            className="absolute top-3 right-3 z-10 text-text-muted hover:text-ink bg-white/80 rounded-full border-none cursor-pointer p-1.5 tap"
          >
            <X size={16} />
          </button>
        ) : (
          <div className="sticky top-0 bg-white flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
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
        )}

        {children && <div className={bare ? "" : "px-5 py-4"}>{children}</div>}

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
