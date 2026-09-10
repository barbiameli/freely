"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { markOnboardingSeenAction } from "@/actions/portal-visitor";
import { useT } from "@/lib/i18n/context";

export interface WelcomeStep {
  kind: string;
  title: string;
  body: string;
}

/**
 * The client's first sign-in, shaped like the freelancer's own onboarding.
 *
 * Same furniture on purpose: a segmented bar across the top, one thing at a
 * time filling the screen, Back and Next at the bottom. Somebody who has seen
 * Freely set itself up recognises this immediately, and somebody who has not
 * gets the thing that shape is good at, which is reading five short pieces
 * without deciding to.
 *
 * The alternative was a single page with five headings, and the reason it is
 * not that: a page of rules is skimmed and a step you have to press past is
 * read. That is the whole difference, and it is the point of doing this at
 * all.
 *
 * The same content lives in a tab afterwards, because week six is when
 * somebody wants to check the revisions line and week one is when they were
 * told it.
 */
export function WelcomeSteps({
  slug,
  steps,
  studio,
  onDone,
}: {
  slug: string;
  steps: WelcomeStep[];
  studio: string;
  /** Hand back to the dashboard without a round trip. */
  onDone: () => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);

  if (steps.length === 0) return null;
  const step = steps[index];
  const last = index === steps.length - 1;

  function finish() {
    // Recorded against the visitor, so this is the last time they see it on
    // any device. Not awaited: the dashboard should not wait on a write whose
    // only job is to stop a card appearing.
    void markOnboardingSeenAction(slug);
    onDone();
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-xl">
        <div className="flex gap-1.5 mb-6">
          {steps.map((each, i) => (
            <div
              key={each.kind}
              className={`h-1 flex-1 rounded-full ${i <= index ? "bg-violet" : "bg-line"}`}
            />
          ))}
        </div>

        <div className="bg-white rounded-card border border-line shadow-card px-6 sm:px-9 py-8">
          {index === 0 && studio && (
            <p className="font-label text-caption uppercase tracking-[0.09em] text-text-muted m-0 mb-2">
              {studio}
            </p>
          )}
          <h1 className="font-display text-[28px] sm:text-[34px] leading-[1.06] text-ink m-0">
            {step.title}
          </h1>
          <p className="text-body text-slate leading-relaxed whitespace-pre-line mt-4 mb-0">
            {step.body}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 mt-6">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="inline-flex items-center gap-2 font-body font-semibold text-small text-slate bg-none border-none cursor-pointer disabled:opacity-0 py-2 tap"
          >
            <ArrowLeft size={15} />
            {t.common.back}
          </button>

          <button
            type="button"
            onClick={() => (last ? finish() : setIndex((i) => i + 1))}
            className="inline-flex items-center gap-2 font-body font-bold text-sm rounded-full px-6 py-3 border-none cursor-pointer press bg-violet text-ink hover:bg-violet-deep transition-colors"
          >
            {last ? <Check size={15} /> : null}
            {last ? t.welcomeSteps.done : t.welcomeSteps.next}
            {last ? null : <ArrowRight size={15} />}
          </button>
        </div>

        {/* A way past it that is not the last step. Somebody who arrived to
            find one specific thing should not have to press through five
            screens to get at it. */}
        {!last && (
          <button
            type="button"
            onClick={finish}
            className="w-full font-body font-semibold text-meta text-link bg-none border-none cursor-pointer py-2 mt-2"
          >
            {t.welcomeSteps.skip}
          </button>
        )}
      </div>
    </div>
  );
}
