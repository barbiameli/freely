"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Mail } from "lucide-react";
import { portalSignInAction, requestPortalLinkAction } from "@/actions/portal-visitor";
import { useT } from "@/lib/i18n/context";

/**
 * The gate.
 *
 * Two ways in, and they are equals rather than a main one and a fallback.
 * Somebody who has set a password uses it; somebody who has not, or who has
 * forgotten, gets a link. That link is also the reset flow, which is why there
 * is not a separate one: a password reset is an emailed link with extra steps.
 *
 * Every refusal says the same sentence. Not on the list, wrong password and no
 * such portal are one message, because the person typing already has the URL
 * and telling them apart would turn this into a way of finding out who a
 * freelancer works with.
 */
export function SignInForm({ slug, studio }: { slug: string; studio: string }) {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");

  function explain(code: string): string {
    if (code === "portal.tooMany") return t.portalSignIn.tooMany;
    if (code === "portal.badEmail") return t.portalSignIn.badEmail;
    // Everything else, including a wrong password and an address nobody
    // invited, is the same sentence on purpose.
    return t.portalSignIn.wrong;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("busy");
    setError("");

    if (mode === "link") {
      const result = await requestPortalLinkAction(slug, email);
      if (result.ok) {
        setState("sent");
        return;
      }
      setState("idle");
      setError(explain(result.error));
      return;
    }

    const result = await portalSignInAction(slug, email, password);
    if (result.ok) {
      // A full navigation rather than a client push: the page behind this is
      // rendered on the server and reads the cookie that was just set.
      router.refresh();
      return;
    }
    setState("idle");
    setError(explain(result.error));
  }

  if (state === "sent") {
    return (
      <div className="flex items-start gap-3" role="status">
        <span
          className="flex items-center justify-center w-8 h-8 rounded-full bg-mint-solid shrink-0"
          aria-hidden
        >
          <Check size={16} strokeWidth={3} className="text-ink" />
        </span>
        <div>
          <p className="font-body font-bold text-body text-ink m-0">{t.portalSignIn.sentTitle}</p>
          <p className="text-small text-slate mt-1 mb-0">{t.portalSignIn.sentBody}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <h1 className="font-display text-[26px] leading-tight text-ink m-0">
        {t.portalSignIn.title}
      </h1>
      <p className="text-small text-slate mt-1.5 mb-5">
        {studio ? t.portalSignIn.bodyNamed.replace("{studio}", studio) : t.portalSignIn.body}
      </p>

      <label className="block text-caption text-text-muted mb-1" htmlFor="portal-email">
        {t.portalSignIn.email}
      </label>
      <input
        id="portal-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-sm px-3.5 py-3 text-body outline-none border border-line bg-white text-ink focus:border-violet"
      />

      {mode === "password" && (
        <>
          <label className="block text-caption text-text-muted mb-1 mt-3.5" htmlFor="portal-password">
            {t.portalSignIn.password}
          </label>
          <input
            id="portal-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-sm px-3.5 py-3 text-body outline-none border border-line bg-white text-ink focus:border-violet"
          />
        </>
      )}

      {error && (
        <p role="alert" className="text-small text-overdue mt-3 mb-0">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === "busy"}
        className="w-full inline-flex items-center justify-center gap-2 font-body font-bold text-sm rounded-full px-5 py-3.5 mt-5 border-none cursor-pointer press disabled:opacity-60 bg-violet text-ink hover:bg-violet-deep transition-colors"
      >
        {mode === "password" ? <KeyRound size={15} /> : <Mail size={15} />}
        {state === "busy"
          ? t.portalSignIn.working
          : mode === "password"
            ? t.portalSignIn.signIn
            : t.portalSignIn.sendLink}
      </button>

      {/* The other way, given equal billing. A link is not a lesser door. */}
      <button
        type="button"
        onClick={() => {
          setMode(mode === "password" ? "link" : "password");
          setError("");
        }}
        className="w-full font-body font-semibold text-meta text-link bg-none border-none cursor-pointer py-2 mt-3"
      >
        {mode === "password" ? t.portalSignIn.useLink : t.portalSignIn.usePassword}
      </button>
    </form>
  );
}
