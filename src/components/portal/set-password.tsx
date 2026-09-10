"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { setPortalPasswordAction } from "@/actions/portal-visitor";
import { MIN_PASSWORD } from "@/lib/portal-auth";
import { useT } from "@/lib/i18n/context";

/**
 * Offered to somebody who got in with a link and has no password yet.
 *
 * Offered, not required. A link is a complete way to use this rather than a
 * half-finished signup, and insisting on a password before somebody can look
 * at their own project would be the friction this whole thing exists to avoid.
 * Dismissing it is remembered per browser, since there is nothing else it
 * could sensibly hang on.
 */
export function SetPassword({ slug }: { slug: string }) {
  const t = useT();
  const key = `portal-password-later:${slug}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return Boolean(window.localStorage.getItem(key));
    } catch {
      return false;
    }
  });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (hidden || done) return null;

  async function save() {
    setBusy(true);
    setError("");
    const result = await setPortalPasswordAction(slug, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "portal.shortPassword" ? t.portalPassword.short : t.portalSignIn.wrong);
      return;
    }
    setDone(true);
  }

  return (
    <section className="bg-white rounded-card border border-line shadow-card px-5 sm:px-7 py-5">
      <p className="font-body font-bold text-small text-ink m-0 flex items-center gap-2">
        <KeyRound size={15} className="text-text-muted" aria-hidden />
        {t.portalPassword.title}
      </p>
      <p className="text-caption text-text-muted mt-1 mb-3">{t.portalPassword.body}</p>

      <div className="flex flex-col sm:flex-row gap-2.5 max-w-lg">
        <input
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label={t.portalPassword.label}
          placeholder={t.portalPassword.hint}
          className="flex-1 min-w-0 rounded-sm px-3.5 py-2.5 text-small outline-none border border-line bg-white text-ink focus:border-violet"
        />
        <button
          type="button"
          disabled={busy || password.length < MIN_PASSWORD}
          onClick={() => void save()}
          className="shrink-0 font-body font-bold text-sm rounded-full px-5 py-2.5 border-none cursor-pointer press disabled:opacity-60 bg-violet text-ink hover:bg-violet-deep transition-colors"
        >
          {t.portalPassword.save}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-small text-overdue mt-2 mb-0">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(key, "1");
          } catch {
            // Nothing to do; they will be offered it again next time.
          }
          setHidden(true);
        }}
        className="font-body font-semibold text-meta text-link bg-none border-none cursor-pointer p-0 mt-3 tap"
      >
        {t.portalPassword.later}
      </button>
    </section>
  );
}
