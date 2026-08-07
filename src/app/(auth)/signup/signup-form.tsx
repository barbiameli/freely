"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { signUpAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [studioName, setStudioName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("name", name);
    formData.set("studioName", studioName);
    formData.set("email", email);
    formData.set("password", password);
    const result = await signUpAction(formData);

    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }

    const signInResult = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInResult?.error) {
      setError("Account created, sign in below.");
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
        placeholder="Your name"
        className="w-full font-body text-[13.5px] text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
      />
      <input
        value={studioName}
        onChange={(e) => setStudioName(e.target.value)}
        placeholder="Studio or business name (optional)"
        className="w-full font-body text-[13.5px] text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@studio.com"
        className="w-full font-body text-[13.5px] text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 8 characters)"
        className="w-full font-body text-[13.5px] text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
      />
      <p className="text-[11px] text-text-muted -mt-1">
        That&apos;s all we ask for now, just enough to get you in.
      </p>
      {error && <div className="text-overdue text-xs">{error}</div>}
      <Button
        type="submit"
        disabled={loading || !name.trim() || !email || password.length < 8}
        className="justify-center mt-1"
      >
        {loading ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
