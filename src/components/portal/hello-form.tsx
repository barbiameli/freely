"use client";

import { useState } from "react";
import { Check, Mail } from "lucide-react";
import { requestPortalLinkAction } from "@/actions/portal-visitor";
import { useT } from "@/lib/i18n/context";

/**
 * "Who's looking?", asked once and skippable.
 *
 * Not a gate. The portal is readable by anyone holding the link and stays
 * that way; this only offers to remember them, so the welcome pack can stop
 * leading once they have read it and the freelancer can see who has actually
 * opened the thing.
 *
 * Which is why Skip is a real option sitting next to the button rather than a
 * small grey word underneath it. A client who does not want to hand over an
 * address to look at their own project is being reasonable, and a form that
 * makes that feel like a refusal is worse than no form.
 */
export function HelloForm({ slug, onSkip }: { slug: string; onSkip: () => void }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError("");
    const result = await requestPortalLinkAction(slug, email, name);
    if (result.ok) {
      setState("sent");
      return;
    }
    setState("idle");
    setError(
      result.error === "portal.badEmail"
        ? t.portalHello.badEmail
        : result.error === "portal.tooMany"
          ? t.portalHello.tooMany
          : t.portalHello.failed
    );
  }

  if (state === "sent") {
    return (
      <div className="flex items-start gap-3" role="status">
        <span
          className="flex items-center justify-center w-7 h-7 rounded-full bg-mint-solid shrink-0"
          aria-hidden
        >
          <Check size={15} strokeWidth={3} className="text-ink" />
        </span>
        <div>
          <p className="font-body font-bold text-body text-ink m-0">{t.portalHello.sentTitle}</p>
          <p className="text-small text-slate mt-1 mb-0">{t.portalHello.sentBody}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <p className="font-body font-bold text-body text-ink m-0">{t.portalHello.title}</p>
      <p className="text-small text-slate mt-1 mb-3.5 max-w-prose">{t.portalHello.body}</p>

      <div className="flex flex-col sm:flex-row gap-2.5 max-w-xl">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.portalHello.namePlaceholder}
          aria-label={t.portalHello.nameLabel}
          className="sm:w-40 rounded-sm px-3.5 py-3 text-body outline-none border border-line bg-white text-ink placeholder:text-muted focus:border-violet"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.portalHello.emailPlaceholder}
          aria-label={t.portalHello.emailLabel}
          aria-invalid={error ? true : undefined}
          className="flex-1 min-w-0 rounded-sm px-3.5 py-3 text-body outline-none border border-line bg-white text-ink placeholder:text-muted focus:border-violet"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="shrink-0 inline-flex items-center justify-center gap-2 font-body font-bold text-sm rounded-full px-5 py-3 border-none cursor-pointer press disabled:opacity-60 bg-violet text-ink hover:bg-violet-deep transition-colors"
        >
          <Mail size={15} />
          {state === "sending" ? t.portalHello.sending : t.portalHello.send}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-small text-overdue mt-2.5 mb-0">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="font-body font-semibold text-meta text-link bg-none border-none cursor-pointer p-0 mt-3.5 tap"
      >
        {t.portalHello.skip}
      </button>
    </form>
  );
}
