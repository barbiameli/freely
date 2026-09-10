"use client";

import { useState } from "react";
import { BookOpen, Check, ChevronDown } from "lucide-react";
import { markOnboardingSeenAction } from "@/actions/portal-visitor";
import { WELCOME_QUESTIONS } from "@/lib/welcome-questions";
import { useT } from "@/lib/i18n/context";

/**
 * How this works, said once and then kept somewhere.
 *
 * Two states, one component, because they are the same content at two moments
 * rather than two features. First time it leads the page: this is what you
 * need to know, here is the button that says you have read it. After that it
 * is a line you can open, sitting under everything else, because week six is
 * exactly when somebody wants to check how many rounds of changes they get and
 * exactly when nobody can find the email that said.
 *
 * "Got it" records against the visitor when we know who they are, and
 * otherwise just collapses. Somebody who declined to say who they are has no
 * row to write to, and is not going to be asked again for the privilege of
 * dismissing a card.
 */
export function PortalIntro({
  slug,
  pack,
  answers,
  seen,
}: {
  slug: string;
  /** The prose, written by the freelancer. */
  pack: string;
  /** The structured answers behind it, shown as rows under the prose. */
  answers: Record<string, string>;
  seen: boolean;
}) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(seen);
  const [open, setOpen] = useState(false);

  const rows = WELCOME_QUESTIONS.filter((question) => answers[question.id]);
  if (!pack && rows.length === 0) return null;

  const body = (
    <>
      {pack && (
        <p className="text-body text-slate leading-relaxed whitespace-pre-line m-0 max-w-prose">
          {pack}
        </p>
      )}
      {rows.length > 0 && (
        <dl className="m-0 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {rows.map((question) => (
            <div key={question.id}>
              <dt className="text-caption text-text-muted">{question.ask}</dt>
              <dd className="font-body font-semibold text-small text-ink m-0 mt-0.5">
                {answers[question.id]}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );

  if (collapsed) {
    return (
      <section className="bg-white rounded-card border border-line shadow-card px-5 sm:px-7 py-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="w-full flex items-center gap-2.5 bg-none border-none cursor-pointer text-left p-0 tap-row"
        >
          <BookOpen size={15} className="text-text-muted shrink-0" aria-hidden />
          <span className="flex-1 font-body font-semibold text-small text-ink">
            {t.intro.reminder}
          </span>
          <ChevronDown
            size={14}
            className={`text-text-muted shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
            aria-hidden
          />
        </button>
        {open && <div className="mt-4">{body}</div>}
      </section>
    );
  }

  return (
    <section className="bg-white rounded-card border-[1.5px] border-violet shadow-card px-5 sm:px-7 py-6">
      <h2 className="font-display text-[22px] leading-tight text-ink m-0 mb-3">
        {t.intro.title}
      </h2>
      {body}
      <button
        type="button"
        onClick={() => {
          setCollapsed(true);
          void markOnboardingSeenAction(slug);
        }}
        className="inline-flex items-center gap-2 font-body font-bold text-sm rounded-full px-5 py-3 mt-5 border-none cursor-pointer press bg-violet text-ink hover:bg-violet-deep transition-colors"
      >
        <Check size={15} />
        {t.intro.gotIt}
      </button>
    </section>
  );
}
