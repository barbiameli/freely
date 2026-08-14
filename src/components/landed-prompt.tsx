"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { currencySymbol } from "@/lib/currencies";
import { useAction } from "@/lib/use-action";
import { ActionError } from "@/components/ui/action-error";
import {
  markQuoteWonAction,
  markQuoteLostAction,
  dismissQuotePromptAction,
} from "@/actions/quote-outcome";
import { useT } from "@/lib/i18n/context";

export interface LandedQuote {
  id: string;
  title: string;
  client: string;
  price: number;
  currency?: string | null;
}

/**
 * "Have you landed any of these?", above the quotes list.
 *
 * One question doing two jobs. Quotes were sitting untracked for weeks because
 * tracking is a chore nobody remembers, while the answer to whether the job
 * came in was already known. Asking it directly gets the project into Track and
 * records the outcome in the same tap, and the outcome is what lets the next
 * quote be priced against work that actually landed rather than against every
 * number ever typed.
 *
 * A carousel rather than a list, because this is a prompt sitting on top of the
 * real content. A list of five quotes would push the page down and compete with
 * the thing you came here for; one card at a time is a question, not a section.
 *
 * Closeable, and closing means "not these", not "never again": the server
 * stamps the moment, so anything quoted afterwards brings it back.
 *
 * Answering removes the card in place and slides the next one in. Nothing
 * reloads, because a page jump after a one-tap answer feels like a mistake.
 */
export function LandedPrompt({ quotes }: { quotes: LandedQuote[] }) {
  const t = useT();
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [remaining, setRemaining] = useState(quotes);
  const [index, setIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const [shown, setShown] = useState(false);

  // A beat after the page settles, so it reads as arriving rather than as
  // part of the furniture. See marketing/reveal.tsx for the same reasoning.
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), 220);
    return () => clearTimeout(timer);
  }, []);

  if (closed || remaining.length === 0) return null;

  const current = remaining[Math.min(index, remaining.length - 1)];

  function answered(id: string) {
    setRemaining((rest) => {
      const next = rest.filter((q) => q.id !== id);
      // Stay on the same position so the next card slides into the space,
      // unless that was the last one.
      setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  }

  async function won() {
    const id = current.id;
    const result = await run(() => markQuoteWonAction(id), { skipRefresh: true });
    if (result.ok) {
      answered(id);
      // Refresh so the quote's card in the list below picks up its new state.
      router.refresh();
    }
  }

  async function lost() {
    const id = current.id;
    const result = await run(() => markQuoteLostAction(id), { skipRefresh: true });
    if (result.ok) {
      answered(id);
      router.refresh();
    }
  }

  return (
    <div
      className={`rounded-card border border-violet/30 bg-violet-tint px-4 py-3.5 sm:px-5 transition-[opacity,transform] duration-500 ease-marketing motion-reduce:transition-none ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-body font-bold text-small text-ink">{t.quote.landedTitle}</div>
          <p className="text-caption text-slate mt-0.5 mb-0">{t.quote.landedHint}</p>
        </div>
        <button
          type="button"
          aria-label={t.quote.landedClose}
          title={t.quote.landedClose}
          onClick={() => {
            setClosed(true);
            void dismissQuotePromptAction();
          }}
          className="shrink-0 text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 tap"
        >
          <X size={14} />
        </button>
      </div>

      {/* The card. Keyed on the quote so React swaps the element rather than
          mutating it, which is what makes the change of quote visible. */}
      <div
        key={current.id}
        className="mt-3 bg-white border border-line rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 animate-card-in motion-reduce:animate-none"
      >
        <div className="min-w-0 flex-1">
          <div className="font-body font-semibold text-body text-ink truncate">{current.title}</div>
          <div className="text-caption text-text-muted mt-0.5">
            {current.client} · {currencySymbol(current.currency)}
            {current.price.toLocaleString()}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none">
          <button
            type="button"
            disabled={pending}
            onClick={won}
            className="flex items-center justify-center gap-1.5 font-body font-bold text-meta text-white bg-violet rounded-lg px-3.5 py-2.5 sm:py-2 border-none cursor-pointer disabled:opacity-50 transition-transform duration-200 hover:-translate-y-px motion-reduce:transition-none"
          >
            <Check size={13} />
            {pending ? t.quote.landedSaving : t.quote.landedWon}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={lost}
            className="font-body font-semibold text-meta text-slate bg-white border border-line rounded-lg px-3.5 py-2.5 sm:py-2 cursor-pointer disabled:opacity-50 hover:text-ink hover:border-slate transition-colors"
          >
            {t.quote.landedLost}
          </button>
        </div>
      </div>

      {/* Only worth showing when there is somewhere to go. One quote needs no
          pager, and a disabled pager is a control that lies about being one. */}
      {remaining.length > 1 && (
        <div className="flex items-center justify-end gap-2 mt-2.5">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="text-slate disabled:opacity-30 bg-none border-none cursor-pointer p-0 tap disabled:cursor-default"
            aria-label={t.common.back}
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-caption text-text-muted tabular-nums">
            {index + 1}/{remaining.length}
          </span>
          <button
            type="button"
            disabled={index >= remaining.length - 1}
            onClick={() => setIndex((i) => Math.min(remaining.length - 1, i + 1))}
            className="text-slate disabled:opacity-30 bg-none border-none cursor-pointer p-0 tap disabled:cursor-default"
            aria-label={t.common.continue}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      <ActionError error={error} className="mt-2" />
    </div>
  );
}
