"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FreelyLogo } from "@/components/freely-logo";
import { checkResetTokenAction, resetPasswordAction } from "@/actions/password-reset";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-reset";
import { useT } from "@/lib/i18n/context";

/**
 * Setting a new password from an emailed link.
 *
 * The link is checked on arrival rather than on submit, so somebody who clicked
 * an old email is told immediately instead of typing a password twice first.
 *
 * It does not sign anybody in on its own. Whoever holds the link proves they can
 * read the mailbox, which is enough to set a password and is not the same as
 * being logged in already; the sign-in that follows goes through the ordinary
 * credentials path with the password they just chose.
 */
export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ok" | "bad">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkResetTokenAction(params.token).then((result) => {
      if (!cancelled) setState(result.valid ? "ok" : "bad");
    });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t.auth.passwordsDiffer);
      return;
    }
    setSaving(true);
    setError("");
    const result = await resetPasswordAction(params.token, password);
    if (!result.ok) {
      setSaving(false);
      setError(result.error);
      return;
    }
    // Straight in, since they have just proved both things sign-in asks for:
    // they can read the mailbox, and they know the password they just set. The
    // address comes back from the action rather than being asked for again.
    const signedIn = await signIn("credentials", {
      email: result.data.email,
      password,
      redirect: false,
    });
    setSaving(false);
    // A failed automatic sign-in is not a failed reset: the password is
    // changed either way, so it goes to the sign-in page rather than an error.
    router.push(signedIn?.ok ? "/quote" : "/signin");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-5 py-10">
      <Card className="w-full max-w-sm">
        <div className="mb-1">
          <FreelyLogo />
        </div>

        {state === "checking" && (
          <p className="text-text-muted text-sm mt-4 mb-0">{t.common.loading}</p>
        )}

        {state === "bad" && (
          <>
            <p className="text-slate text-sm mt-4 mb-1">{t.auth.linkDeadTitle}</p>
            <p className="text-text-muted text-xs mb-5">{t.auth.linkDeadBody}</p>
            <Link href="/forgot" className="text-violet text-xs font-semibold no-underline">
              {t.auth.sendResetLink}
            </Link>
          </>
        )}

        {state === "ok" && (
          <>
            <p className="text-slate text-sm mb-1">{t.auth.chooseNewPassword}</p>
            <p className="text-text-muted text-xs mb-5">
              {t.auth.passwordLengthHint.replace("{n}", String(MIN_PASSWORD_LENGTH))}
            </p>
            <form onSubmit={submit} className="flex flex-col gap-3">
              <TextField
                type="password"
                autoComplete="new-password"
                name="new-password"
                value={password}
                onChange={setPassword}
                placeholder={t.auth.newPassword}
              />
              <TextField
                type="password"
                autoComplete="new-password"
                name="confirm-password"
                value={confirm}
                onChange={setConfirm}
                placeholder={t.auth.confirmPassword}
              />
              {error && <div className="text-overdue text-xs">{error}</div>}
              <Button
                type="submit"
                disabled={saving || password.length < MIN_PASSWORD_LENGTH || !confirm}
                className="justify-center mt-1"
              >
                {saving ? t.common.saving : t.auth.setPassword}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
