"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { currencySymbol } from "@/lib/currencies";
import { addBriefToTrackAction } from "@/actions/briefs";
import { DeleteBriefButton } from "@/components/delete-brief-button";

export interface BriefSummary {
  id: string;
  title: string;
  client: string;
  price: number;
  hours: number;
  currency: string | null;
  deliverables: string[];
  status: "DRAFT" | "TRACKED";
  published: boolean;
  createdAt: string;
}

/**
 * A miniature of the generated document.
 *
 * Deliberately not a screenshot or an icon: a scaled-down impression of the
 * real thing (dark cover band, a couple of section blocks, a deliverables
 * list) is enough to recognise a quote at a glance, and costs nothing to
 * render.
 */
export function DocumentPreview({
  brief,
  height = 104,
}: {
  brief: BriefSummary;
  /** Small enough to sit inside a list row, or large enough to lead a card. */
  height?: number;
}) {
  const tiny = height < 60;
  return (
    <div
      aria-hidden
      style={{ height }}
      className="w-full rounded bg-white border border-line overflow-hidden flex flex-col"
    >
      <div className={tiny ? "bg-ink px-1.5 py-1" : "bg-ink px-2.5 py-2"}>
        <div className="w-6 h-[2px] bg-coral rounded-full" />
        <div className="w-3/4 h-[5px] bg-white/85 rounded-full mt-1.5" />
        <div className="w-1/3 h-[3px] bg-white/35 rounded-full mt-1" />
      </div>
      <div className={`flex-1 flex flex-col gap-1 ${tiny ? "px-1.5 py-1" : "px-2.5 py-2"}`}>
        <div className="w-full h-[3px] rounded bg-violet-tint" />
        <div className="w-5/6 h-[3px] rounded bg-violet-tint" />
        {!tiny && (
        <div className="mt-1 flex flex-col gap-[3px]">
          {Array.from({ length: Math.min(3, Math.max(1, brief.deliverables.length)) }).map(
            (_, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="w-[3px] h-[3px] rounded-full bg-coral shrink-0" />
                <div className="h-[3px] rounded bg-coral-tint" style={{ width: `${70 - i * 12}%` }} />
              </div>
            )
          )}
        </div>
        )}
      </div>
    </div>
  );
}

export function BriefCard({ brief }: { brief: BriefSummary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const tracked = brief.status === "TRACKED";

  return (
    <div className="bg-white border border-line rounded-card p-3.5 flex flex-col gap-3 h-full">
      <button
        type="button"
        onClick={() => router.push(`/quote/${brief.id}`)}
        className="text-left bg-none border-none cursor-pointer p-0"
      >
        <DocumentPreview brief={brief} />
        <div className="mt-2.5">
          <div className="font-body font-semibold text-[13.5px] text-ink leading-snug line-clamp-2">
            {brief.title}
          </div>
          <div className="text-[11.5px] text-text-muted mt-0.5 truncate">{brief.client}</div>
        </div>
      </button>

      <div className="flex items-baseline justify-between gap-2 mt-auto">
        <span className="font-body font-bold text-[14px] text-ink">
          {currencySymbol(brief.currency)}
          {brief.price.toLocaleString()}
        </span>
        <div className="flex items-center gap-2.5">
          <span className="text-[10.5px] uppercase tracking-wide text-text-muted">
            {tracked ? "Tracked" : brief.published ? "Published" : "Draft"}
          </span>
          <DeleteBriefButton brief={brief} />
        </div>
      </div>

      {tracked ? (
        <button
          type="button"
          onClick={() => router.push(`/quote/${brief.id}`)}
          className="flex items-center justify-center gap-1.5 w-full text-[12px] font-bold text-slate bg-paper rounded-lg py-2 border-none cursor-pointer"
        >
          <Check size={12} /> In Track
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError("");
            // The action redirects to the new project on success, so there is
            // nothing to do here on the happy path.
            startTransition(async () => {
              try {
                await addBriefToTrackAction(brief.id);
              } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                // Next signals a redirect by throwing, so that one is expected.
                if (!message.includes("NEXT_REDIRECT")) setError("Couldn't send that to Track.");
              }
            });
          }}
          className="flex items-center justify-center gap-1.5 w-full text-[12px] font-bold text-white bg-violet rounded-lg py-2 border-none cursor-pointer disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send to Track"}
          {!pending && <ArrowRight size={12} />}
        </button>
      )}
      {error && <div className="text-overdue text-[11px]">{error}</div>}
    </div>
  );
}
