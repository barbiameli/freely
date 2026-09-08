"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { joinWaitlistAction } from "@/actions/waitlist";
import { useT, useLocale } from "@/lib/i18n/context";

/**
 * The one way in while the beta is closed.
 *
 * A field and a button on a line, because a form that looks like a form asks
 * to be filled in and a button that opens one asks to be thought about.
 *
 * `onDark` exists for the beta panel, which is the ink block. The field has to
 * sit on that background without turning into a white rectangle stuck to it,
 * and the button switches to lime, which is the one place in the system lime
 * carries anything: on ink it clears contrast comfortably, and on white it
 * clears nothing at all.
 */
export function WaitlistForm({ onDark = false }: { onDark?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError("");
    const result = await joinWaitlistAction(email, locale);
    if (result.ok) {
      setState("done");
      return;
    }
    setState("idle");
    // The action returns which thing went wrong rather than a sentence,
    // because the sentence has to exist in both languages and this is the
    // side of the wire that knows which one is being read.
    setError(
      result.error === "wait.badEmail"
        ? t.wait.badEmail
        : result.error === "wait.tooMany"
          ? t.wait.tooMany
          : t.wait.failed
    );
  }

  if (state === "done") {
    return (
      <p
        className={`flex items-center justify-center gap-2 font-body font-semibold text-body m-0 ${
          onDark ? "text-white" : "text-ink"
        }`}
        // Announced rather than merely shown: the field it replaces was the
        // thing being used, so a screen reader has to hear what happened to it.
        role="status"
      >
        <span
          className="flex items-center justify-center w-6 h-6 rounded-full bg-lime shrink-0"
          aria-hidden
        >
          <Check size={14} strokeWidth={3} className="text-ink" />
        </span>
        {t.wait.done}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-md mx-auto">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <label className="sr-only" htmlFor="waitlist-email">
          {t.wait.label}
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.wait.placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "waitlist-error" : undefined}
          className={`flex-1 min-w-0 rounded-sm px-3.5 py-3 text-body outline-none border transition-colors ${
            onDark
              ? "bg-white/10 border-white/25 text-white placeholder:text-white/55 focus:border-lime"
              : "bg-surface border-hair text-ink placeholder:text-muted focus:border-violet"
          }`}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className={`shrink-0 font-body font-bold text-sm rounded-full px-6 py-3 border-none cursor-pointer press disabled:opacity-60 transition-colors ${
            onDark
              ? "bg-lime text-ink hover:bg-[#B9E92F]"
              : "bg-violet text-ink hover:bg-violet-deep"
          }`}
        >
          {state === "sending" ? t.wait.sending : t.wait.join}
        </button>
      </div>
      {error && (
        <p
          id="waitlist-error"
          role="alert"
          className={`text-small mt-2.5 mb-0 ${onDark ? "text-lime" : "text-overdue"}`}
        >
          {error}
        </p>
      )}
    </form>
  );
}
