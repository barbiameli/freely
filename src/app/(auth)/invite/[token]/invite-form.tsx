"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { redeemInviteAction } from "@/actions/team";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";

export function InviteForm({ token, presetEmail }: { token: string; presetEmail: string | null }) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState(presetEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    const result = await redeemInviteAction(token, formData);

    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }

    const signInResult = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInResult?.error) {
      router.push("/signin");
      return;
    }
    router.push("/quote");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@studio.com"
        readOnly={Boolean(presetEmail)}
        className="w-full font-body text-body text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t.auth.passwordMin}
        className="w-full font-body text-body text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
      />
      {error && <div className="text-overdue text-xs">{error}</div>}
      <Button
        type="submit"
        disabled={loading || !email || password.length < 8}
        className="justify-center mt-1"
      >
        {loading ? "Joining..." : "Join the team"}
      </Button>
    </form>
  );
}
