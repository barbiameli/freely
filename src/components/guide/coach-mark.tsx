"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { dismissGuideStepAction } from "@/actions/guide";
import type { GuideStep } from "@/lib/guide";
import { useT } from "@/lib/i18n/context";
import type { Dictionary } from "@/lib/i18n";

/**
 * A hint that points at the real button.
 *
 * Not a spotlight. A dimmed page with a hole cut in it is impossible to miss
 * and impossible to work around: it takes the app away from somebody in order
 * to explain the app to them, and the first thing most people do is hunt for
 * the way to close it. This leaves the page live. The card sits under the
 * thing it is talking about, the thing itself gets a soft ring, and anybody
 * who would rather just get on with it can.
 *
 * It finds its target by data attribute rather than by ref, so the button
 * being pointed at needs to know nothing about the guide. A page marks a
 * button with data-guide="track" and that is the whole contract.
 *
 * If the target is not on the page, nothing renders. A card pointing at empty
 * space is worse than no card, and this is the likely outcome whenever a
 * layout changes and nobody remembers the guide exists.
 */
export function CoachMark({ step }: { step: GuideStep }) {
  const t = useT();
  const [box, setBox] = useState<DOMRect | null>(null);
  const [gone, setGone] = useState(false);
  const target = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-guide="${step}"]`);
    if (!el) return;
    target.current = el;

    function place() {
      if (target.current) setBox(target.current.getBoundingClientRect());
    }
    place();

    // The page moves under it: images load, cards animate in, somebody
    // scrolls. Following is cheaper than guessing a position once and being
    // wrong for the rest of the session.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    const timer = window.setInterval(place, 500);

    el.classList.add("guide-target");
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      window.clearInterval(timer);
      el.classList.remove("guide-target");
    };
  }, [step]);

  function dismiss() {
    setGone(true);
    // Recorded on the account, and deliberately not awaited. The hint is
    // already off the screen; making somebody watch a spinner to close a hint
    // would be worse than the small chance of it reappearing after a failure.
    void dismissGuideStepAction(step);
  }

  if (gone || !box) return null;

  const copy = wording(step, t);

  // Under the target by default, above it when the target is near the bottom.
  const below = box.bottom + 200 < window.innerHeight;
  const top = below ? box.bottom + 12 : box.top - 12;
  const left = Math.max(16, Math.min(box.left, window.innerWidth - 336));

  return (
    <div
      className="fixed z-40 w-[320px] animate-dialog-in motion-reduce:animate-none"
      style={{ top, left, transform: below ? undefined : "translateY(-100%)" }}
      role="note"
    >
      <div className="bg-ink text-white rounded-card shadow-dialog px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="font-body font-bold text-small text-white text-pretty">{copy.title}</div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t.common.close}
            className="shrink-0 text-white/60 hover:text-white bg-none border-none cursor-pointer p-0 tap"
          >
            <X size={14} />
          </button>
        </div>
        <p className="text-meta text-white/80 mt-1.5 mb-0 text-pretty">{copy.body}</p>
        <button
          type="button"
          onClick={dismiss}
          className="font-body font-semibold text-meta text-white/70 hover:text-white bg-none border-none cursor-pointer p-0 mt-2.5 tap"
        >
          {t.guide.gotIt}
        </button>
      </div>
    </div>
  );
}

/**
 * The two lines for a step.
 *
 * A switch rather than a lookup by template key, so a step added without copy
 * fails to compile instead of rendering "undefined" at somebody.
 */
function wording(step: GuideStep, t: Dictionary): { title: string; body: string } {
  switch (step) {
    case "quote":
      return { title: t.guide.quoteTitle, body: t.guide.quoteBody };
    case "publish":
      return { title: t.guide.publishTitle, body: t.guide.publishBody };
    case "track":
      return { title: t.guide.trackTitle, body: t.guide.trackBody };
    case "breakdown":
      return { title: t.guide.breakdownTitle, body: t.guide.breakdownBody };
    case "client":
      return { title: t.guide.clientTitle, body: t.guide.clientBody };
    case "share":
      return { title: t.guide.shareTitle, body: t.guide.shareBody };
    case "invoice":
      return { title: t.guide.invoiceTitle, body: t.guide.invoiceBody };
  }
}
