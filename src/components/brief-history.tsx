"use client";

import { useRef, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DocumentPreview, type BriefSummary } from "@/components/brief-card";
import { currencySymbol } from "@/lib/currencies";
import { addBriefToTrackAction } from "@/actions/briefs";

/**
 * Past quotes, above the wizard.
 *
 * The first attempt gave each quote a card carrying a thumbnail, title,
 * client, price, status and a filled button. Six things times four cards,
 * sitting above the actual task, read as clutter. This keeps the sideways
 * scroll and the thumbnail, and drops everything else to a title, a price and
 * one text link.
 */

/** The send-to-Track action, as a text link rather than a button, so
 * it does not compete with Continue further down the page. */
function TrackLink({ brief, className }: { brief: BriefSummary; className?: string }) {
  const [pending, startTransition] = useTransition();

  if (brief.status === "TRACKED") {
    return <span className={`text-[12px] text-text-muted ${className ?? ""}`}>Tracked</span>;
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        startTransition(async () => {
          try {
            await addBriefToTrackAction(brief.id);
          } catch {
            // The action redirects on success, which throws by design.
          }
        });
      }}
      className={`text-[12px] font-semibold text-violet bg-none border-none cursor-pointer p-0 disabled:opacity-50 ${
        className ?? ""
      }`}
    >
      {pending ? "Sending..." : "Send to Track"}
    </button>
  );
}

function money(brief: BriefSummary) {
  return `${currencySymbol(brief.currency)}${brief.price.toLocaleString()}`;
}

function Strip({ briefs }: { briefs: BriefSummary[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: -1 | 1) {
    trackRef.current?.scrollBy({
      left: direction * (trackRef.current.clientWidth * 0.8),
      behavior: "smooth",
    });
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <span className="font-body font-semibold text-[13px] text-ink">Pick up where you left off</span>
        <div className="flex items-center gap-3">
          <Link href="/quote/all" className="text-[12px] font-semibold text-violet">
            See all {briefs.length}
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Scroll left"
              className="w-6 h-6 rounded-full border border-line bg-white flex items-center justify-center cursor-pointer text-text-muted"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Scroll right"
              className="w-6 h-6 rounded-full border border-line bg-white flex items-center justify-center cursor-pointer text-text-muted"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={trackRef}
        className="flex gap-2.5 overflow-x-auto pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {briefs.map((brief) => (
          <div
            key={brief.id}
            className="w-[196px] shrink-0 snap-start bg-white border border-line rounded-card p-2.5"
          >
            <Link href={`/quote/${brief.id}`} className="block no-underline">
              <DocumentPreview brief={brief} height={64} />
              <div className="font-body font-semibold text-[12.5px] text-ink mt-2 truncate">
                {brief.title}
              </div>
            </Link>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="text-[12px] text-text-muted">{money(brief)}</span>
              <TrackLink brief={brief} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BriefHistory({ briefs }: { briefs: BriefSummary[] }) {
  if (briefs.length === 0) return null;
  return <Strip briefs={briefs} />;
}
