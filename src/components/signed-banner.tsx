"use client";

import { useState } from "react";
import Link from "next/link";
import { PenLine, X } from "lucide-react";
import { markAcceptanceSeenAction } from "@/actions/quote-outcome";
import { useT } from "@/lib/i18n/context";
import { fill } from "@/lib/i18n";

export interface SignedQuote {
  briefId: string;
  title: string;
  client: string;
  /** Null when tracking failed, which is rare but should not break the link. */
  projectId: string | null;
}

/**
 * "A client signed this, and it is already in Track."
 *
 * A banner rather than a modal, on purpose. The event happened while the
 * freelancer was elsewhere, so there is nothing urgent to interrupt: a modal
 * that fires the moment the app loads makes good news feel like an alert, and
 * gets dismissed reflexively along with everything else.
 *
 * It says the project already exists rather than offering to create it,
 * because by the time this is read it does. The client signed; waiting for a
 * confirmation click is what left signed work untracked.
 *
 * Dismissed per quote, so it says each one once and does not come back.
 */
export function SignedBanner({ signed }: { signed: SignedQuote[] }) {
  const t = useT();
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = signed.filter((s) => !hidden.includes(s.briefId));

  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((s) => (
        <div
          key={s.briefId}
          className="rounded-card border border-violet/40 bg-white px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 animate-card-in motion-reduce:animate-none"
        >
          <PenLine size={15} className="text-violet shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-body font-semibold text-small text-ink">
              {fill(t.quote.signedTitle, { client: s.client, title: s.title })}
            </div>
            <div className="text-caption text-text-muted mt-0.5">{t.quote.signedBody}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {s.projectId && (
              <Link
                href={`/track/${s.projectId}`}
                className="font-body font-bold text-meta text-white bg-violet rounded-lg px-3.5 py-2 no-underline"
              >
                {t.quote.signedOpen}
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setHidden((h) => [...h, s.briefId]);
                void markAcceptanceSeenAction(s.briefId);
              }}
              className="text-caption font-semibold text-slate bg-none border-none cursor-pointer p-0 tap flex items-center gap-1"
            >
              <X size={12} />
              {t.quote.signedDismiss}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
