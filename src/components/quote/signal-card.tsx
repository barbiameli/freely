"use client";

import { AlertCircle, Check, Eye, FileText, Scale, User } from "lucide-react";
import type { SignalLevel, SignalSource } from "@/lib/plan-signals";
import type { Dictionary } from "@/lib/i18n";

/**
 * One thing on the plan screen, wearing how much it matters.
 *
 * Three lights. Coral needs an answer before the quote is written, amber is
 * worth a look and fine to leave, and green is already settled and here to be
 * read. The colour is on a rail down the left edge and on a dot beside the
 * title, so the level survives being skim-read and does not depend on
 * distinguishing two background tints.
 *
 * Where it came from rides alongside as an icon and a word, because "the
 * client asked for this" and "your own rule says this" are different claims
 * and a freelancer answers them differently. It is deliberately quieter than
 * the level: it is the second question, not the first.
 */
const RAIL: Record<SignalLevel, string> = {
  decide: "bg-coral",
  check: "bg-amber",
  settled: "bg-success",
};

const DOT: Record<SignalLevel, string> = {
  decide: "bg-coral",
  check: "bg-amber",
  settled: "bg-success",
};

const TINT: Record<SignalLevel, string> = {
  decide: "bg-coral-tint",
  check: "bg-amber-tint",
  settled: "bg-white",
};

const SOURCE_ICON: Record<SignalSource, typeof User> = {
  brief: FileText,
  rules: Scale,
  history: User,
  you: Eye,
};

function levelWord(level: SignalLevel, t: Dictionary): string {
  if (level === "decide") return t.quote.signalDecide;
  if (level === "check") return t.quote.signalCheck;
  return t.quote.signalSettled;
}

function sourceWord(source: SignalSource, t: Dictionary): string {
  if (source === "brief") return t.quote.signalFromBrief;
  if (source === "rules") return t.quote.signalFromRules;
  if (source === "history") return t.quote.signalFromHistory;
  return t.quote.signalFromYou;
}

export function SignalCard({
  level,
  source,
  title,
  hint,
  t,
  children,
}: {
  level: SignalLevel;
  source: SignalSource;
  title: string;
  hint?: string;
  t: Dictionary;
  children: React.ReactNode;
}) {
  const SourceIcon = SOURCE_ICON[source];
  const LevelIcon = level === "decide" ? AlertCircle : level === "settled" ? Check : null;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-line ${TINT[level]}`}
    >
      {/* The rail. Colour carried by position as well as hue, so it reads
          without relying on telling two pale tints apart. */}
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${RAIL[level]}`} aria-hidden />

      <div className="pl-5 pr-5 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${DOT[level]}`} aria-hidden />
          <h3 className="font-body font-bold text-caption uppercase tracking-[0.08em] text-ink m-0">
            {title}
          </h3>
          {/* The level in words as well as in colour, for anyone who cannot
              use the colour. */}
          <span className="sr-only">{levelWord(level, t)}</span>
          {LevelIcon && (
            <LevelIcon
              size={13}
              className={level === "decide" ? "text-coral" : "text-success"}
              aria-hidden
            />
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-caption text-text-muted shrink-0">
            <SourceIcon size={12} aria-hidden />
            {sourceWord(source, t)}
          </span>
        </div>

        {hint && <p className="text-caption text-slate mt-1.5 mb-0 max-w-prose text-pretty">{hint}</p>}

        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}
