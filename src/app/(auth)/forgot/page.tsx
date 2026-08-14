"use client";

import { useState } from "react";
import Link from "next/link";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FreelyLogo } from "@/components/freely-logo";
import { requestPasswordResetAction } from "@/actions/password-reset";
import { useT } from "@/lib/i18n/context";

/**
 * Asking for a reset link.
 *
 * The page says the same thing whether or not the address has an account. That
 * is the whole design: a form that answers "no account with that email" is a way
 * to find out who has signed up here, and Freely is where freelancers keep their
 * client lists.
 *
 * So the confirmation is worded to be true either way. "If there is an account,
 * a link is on its way" is not a hedge, it is the only honest sentence that does
 * not leak.
 */
export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await requestPasswordResetAction(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-5 py-10">
      <Card className="w-full max-w-sm">
        <div className="mb-1">
          <FreelyLogo />
        </div>

        {sent ? (
          <>
            <p className="text-slate text-sm mt-4 mb-1">{t.auth.resetSentTitle}</p>
            <p className="text-text-muted text-xs mb-5">{t.auth.resetSentBody}</p>
            <Link href="/signin" className="text-violet text-xs font-semibold no-underline">
              {t.auth.backToSignIn}
            </Link>
          </>
        ) : (
          <>
            <p className="text-slate text-sm mb-1">{t.auth.forgotTitle}</p>
            <p className="text-text-muted text-xs mb-5">{t.auth.forgotBody}</p>
            <form onSubmit={submit} className="flex flex-col gap-3">
              <TextField
                name="email"
                value={email}
                onChange={setEmail}
                placeholder={t.auth.emailPlaceholder}
              />
              {error && <div className="text-overdue text-xs">{error}</div>}
              <Button
                type="submit"
                disabled={loading || !email}
                className="justify-center mt-1"
              >
                {loading ? t.auth.sendingLink : t.auth.sendResetLink}
              </Button>
            </form>
            <p className="text-xs text-text-muted mt-5">
              <Link href="/signin" className="text-violet font-semibold">
                {t.auth.backToSignIn}
              </Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
