"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BriefCard, type BriefSummary } from "@/components/brief-card";

/**
 * Recent quotes, above the wizard.
 *
 * They used to be a list of titles at the very bottom of the page, below a
 * long form, which meant a quote you made yesterday was harder to reach than
 * making a new one. Cards, at the top, with the send-to-Track action on the
 * card itself, since that is the thing you come back to do.
 *
 * A native scroller rather than a JavaScript carousel: it gets touch, trackpad
 * and keyboard for free, and the arrows are a convenience on top.
 */
export function BriefCarousel({ briefs }: { briefs: BriefSummary[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  if (briefs.length === 0) return null;

  function scrollBy(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * (track.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="font-body font-semibold text-[15px] text-ink m-0">Your quotes</h2>
          <Link href="/quote/all" className="text-[12.5px] font-semibold text-violet">
            See all {briefs.length > 8 ? `(${briefs.length})` : ""}
          </Link>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className="w-7 h-7 rounded-full border border-line bg-white flex items-center justify-center cursor-pointer text-slate hover:text-ink"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className="w-7 h-7 rounded-full border border-line bg-white flex items-center justify-center cursor-pointer text-slate hover:text-ink"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {briefs.map((brief) => (
          <div key={brief.id} className="w-[210px] shrink-0 snap-start">
            <BriefCard brief={brief} />
          </div>
        ))}
      </div>
    </section>
  );
}
