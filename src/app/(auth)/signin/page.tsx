"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FreelyLogo } from "@/components/freely-logo";
import Link from "next/link";
import { useT } from "@/lib/i18n/context";

export default function SignInPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Couldn't sign in, check your email and password.");
      return;
    }
    router.push("/quote");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-5 py-10">
      <Card className="w-full max-w-sm">
        <div className="mb-1">
          <FreelyLogo />
        </div>
        <p className="text-slate text-sm mb-6">{t.auth.signIn}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <TextField
            name="email"
            value={email}
            onChange={setEmail}
            placeholder={t.auth.emailPlaceholder}
          />
          <input type="hidden" />
          <TextFieldPassword value={password} onChange={setPassword} />
          {error && <div className="text-overdue text-xs">{error}</div>}
          <Button type="submit" disabled={loading || !email || !password} className="justify-center mt-1">
            {loading ? t.auth.signingIn : t.auth.signInAction}
          </Button>
        </form>
        {process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true" && (
          <>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-line" />
              <span className="text-xs text-text-muted">{t.auth.or}</span>
              <div className="flex-1 h-px bg-line" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={() => signIn("google", { callbackUrl: "/quote" })}
            >
              {t.auth.continueWithGoogle}
            </Button>
          </>
        )}
        {/* Under the form rather than beside the password field, so it is
            found when it is wanted and ignored when it is not. */}
        <p className="text-xs text-text-muted mt-5">
          <Link href="/forgot" className="text-violet font-semibold">
            {t.auth.forgotPassword}
          </Link>
        </p>
        <p className="text-xs text-text-muted mt-2">
          {t.auth.firstTimeHere}{" "}
          <Link href="/signup" className="text-violet font-semibold">
            {t.auth.createYourAccount}
          </Link>
        </p>
      </Card>
    </div>
  );
}

function TextFieldPassword({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  return (
    <input
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t.auth.password}
      className="w-full font-body text-body text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
    />
  );
}
