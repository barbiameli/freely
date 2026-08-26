"use client";

import Link from "next/link";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { signUpAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";

export function SignUpForm() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [studioName, setStudioName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Unticked, and it stays unticked unless somebody ticks it. A pre-ticked box
  // is not consent, whatever the conversion rate says.
  const [marketing, setMarketing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("name", name);
    formData.set("studioName", studioName);
    formData.set("email", email);
    formData.set("password", password);
    if (marketing) formData.set("marketingOptIn", "on");
    const result = await signUpAction(formData);

    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }

    const signInResult = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInResult?.error) {
      setError(t.auth.accountCreated);
      router.push("/signin");
      return;
    }
    router.push("/quote");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.onboarding.yourName}
        className="w-full font-body text-body text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
      />
      <input
        value={studioName}
        onChange={(e) => setStudioName(e.target.value)}
        placeholder={t.auth.studioOptional}
        className="w-full font-body text-body text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t.auth.emailPlaceholder}
        className="w-full font-body text-body text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t.auth.passwordMin}
        className="w-full font-body text-body text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
      />
      <p className="text-caption text-text-muted -mt-1">
        {t.auth.justEnough}
      </p>
      {/* Separate from the account, and clearly optional. Nothing about
          creating an account depends on it. */}
      <label className="flex items-start gap-2.5 cursor-pointer mt-1">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-[3px] accent-violet shrink-0"
        />
        <span className="min-w-0">
          <span className="block text-small text-slate">{t.auth.marketingOptIn}</span>
          <span className="block text-caption text-text-muted mt-0.5">
            {t.auth.marketingOptInHint}
          </span>
        </span>
      </label>
      {error && <div className="text-overdue text-xs">{error}</div>}

      {/* A line rather than a tickbox nobody reads.
          A compulsory "I agree" checkbox is a ritual: it produces a click and
          no knowledge, and it adds a step between somebody and the thing they
          came for. Saying what accepting means, next to the button that does
          the accepting, is the honest version of the same thing, and the link
          is there for anybody who wants the detail before they press it. */}
      <p className="text-caption text-text-muted -mt-1 mb-0 text-pretty">
        {t.auth.dataNote}{" "}
        <Link href="/terms" target="_blank" className="text-violet font-semibold">
          {t.auth.dataNoteLink}
        </Link>
      </p>

      <Button
        type="submit"
        loading={loading}
        disabled={!name.trim() || !email || password.length < 8}
        className="justify-center mt-1"
      >
        {loading ? t.auth.creatingAccount : t.auth.createAccount}
      </Button>
    </form>
  );
}
