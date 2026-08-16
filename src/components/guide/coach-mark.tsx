"use client";

import { useEffect, useState } from "react";
import {
  X,
  FileText,
  Send,
  ListChecks,
  Globe,
  Link2,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { dismissGuideStepAction } from "@/actions/guide";
import { FreelyFace } from "@/components/guide/freely-face";
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
 * It has a face and an icon: the face so the advice reads as somebody talking
 * rather than as a system message, the icon so the subject is legible before
 * the sentence is. It arrives with a small drop, because a card that fades in
 * at the top of a page is a cookie banner and gets treated like one.
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

  /** Scrolls to the thing being described, then closes. */
  function show() {
    const el = document.querySelector<HTMLElement>(`[data-guide="${step}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    dismiss();
  }

  if (gone) return null;

  const { title, body, Icon } = wording(step, t);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[min(520px,calc(100vw-32px))] animate-guide-in motion-reduce:animate-none">
      <div className="flex items-start gap-3.5 bg-ink text-white rounded-card shadow-dialog px-4 py-3.5">
        <FreelyFace />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon size={13} className="text-white/70 shrink-0" />
            <span className="font-body font-bold text-small text-white text-pretty">{title}</span>
          </div>
          <p className="text-meta text-white/80 mt-1 mb-0 text-pretty">{body}</p>

          <button
            type="button"
            onClick={show}
            className="font-body font-bold text-meta text-ink bg-white rounded-full px-3 py-1.5 border-none cursor-pointer mt-2.5 tap hover:opacity-90 transition-opacity"
          >
            {t.guide.showMe}
          </button>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t.common.close}
          className="shrink-0 text-white/50 hover:text-white bg-none border-none cursor-pointer p-0 tap"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

/**
 * The words and the picture for a step.
 *
 * A switch rather than a lookup, so a step added without copy fails to compile
 * instead of rendering "undefined" at somebody.
 */
function wording(
  step: GuideStep,
  t: Dictionary
): { title: string; body: string; Icon: LucideIcon } {
  switch (step) {
    case "quote":
      return { title: t.guide.quoteTitle, body: t.guide.quoteBody, Icon: FileText };
    case "publish":
      return { title: t.guide.publishTitle, body: t.guide.publishBody, Icon: Send };
    case "track":
      return { title: t.guide.trackTitle, body: t.guide.trackBody, Icon: ListChecks };
    case "breakdown":
      return { title: t.guide.breakdownTitle, body: t.guide.breakdownBody, Icon: ListChecks };
    case "client":
      return { title: t.guide.clientTitle, body: t.guide.clientBody, Icon: Globe };
    case "share":
      return { title: t.guide.shareTitle, body: t.guide.shareBody, Icon: Link2 };
    case "invoice":
      return { title: t.guide.invoiceTitle, body: t.guide.invoiceBody, Icon: Receipt };
  }
}
