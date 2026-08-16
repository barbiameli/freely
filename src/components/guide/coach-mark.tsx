"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { dismissGuideStepAction } from "@/actions/guide";
import { GuideArt } from "@/components/guide/guide-art";
import type { GuideStep } from "@/lib/guide";
import { useT } from "@/lib/i18n/context";
import type { Dictionary } from "@/lib/i18n";

/**
 * Freely, saying one thing.
 *
 * The first version floated next to the button it described, near the bottom of
 * the page. Three things were wrong with it and all three came from the same
 * decision. It sat over the page, so it covered the button it was pointing at
 * and you could not press the thing you had just been told to press. Its
 * position was measured from an element, so it moved whenever anything else
 * did. And it only appeared once you had scrolled down to whatever it was
 * attached to, which is the one moment somebody is already busy.
 *
 * So it is pinned to the top of the window instead. Always visible, never over
 * a control, because nothing it talks about lives up there. The connection to
 * the button is made by ringing the button rather than by sitting next to it,
 * and a Show me scrolls to it for anybody who cannot see it.
 *
 * White, with a small line drawing of whatever it is describing. Dark was the
 * wrong instinct: at the top of a page a dark slab reads as a system message,
 * and a system message is something people close without reading. White with a
 * border is the same material as every other card in the app, so it reads as
 * part of Freely rather than as an interruption from it.
 *
 * The drawing does the work the colour was meant to do. It arrives with a small
 * drop, because something that fades in at the top of a page is a cookie banner
 * and gets treated like one.
 */
export function CoachMark({ step }: { step: GuideStep }) {
  const t = useT();
  const [gone, setGone] = useState(false);

  // The ring on whatever this is about. Nothing else here touches the page.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-guide="${step}"]`);
    if (!el) return;
    el.classList.add("guide-target");
    return () => el.classList.remove("guide-target");
  }, [step]);

  function dismiss() {
    setGone(true);
    // Not awaited. The card is already off the screen, and making somebody
    // watch a spinner to close a hint would be worse than the small chance of
    // it coming back after a failure.
    void dismissGuideStepAction(step);
  }

  /**
   * Scrolls to the thing being described, and stays put.
   *
   * It used to close on the way. That is the wrong moment: somebody who has
   * just scrolled to a control they have never used still wants the sentence
   * explaining it, and closing the explanation as a reward for looking is
   * backwards. It goes when the X is pressed, or when the thing it asked for
   * has been done, which the next page load works out for itself.
   */
  function show() {
    const el = document.querySelector<HTMLElement>(`[data-guide="${step}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (gone) return null;

  const { title, body } = wording(step, t);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[min(520px,calc(100vw-32px))] animate-guide-in motion-reduce:animate-none">
      <div className="flex items-start gap-4 bg-white border border-line rounded-card shadow-dialog px-4 py-4">
        <GuideArt step={step} />

        <div className="min-w-0 flex-1">
          <div className="font-body font-bold text-small text-ink text-pretty">{title}</div>
          <p className="text-meta text-slate mt-1 mb-0 text-pretty">{body}</p>

          <button
            type="button"
            onClick={show}
            className="font-body font-bold text-meta text-white bg-violet rounded-full px-3.5 py-1.5 border-none cursor-pointer mt-3 tap hover:opacity-90 transition-opacity"
          >
            {t.guide.showMe}
          </button>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t.common.close}
          className="shrink-0 text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 tap"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

/**
 * The two lines for a step.
 *
 * A switch rather than a lookup, so a step added without copy fails to compile
 * instead of rendering "undefined" at somebody.
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
