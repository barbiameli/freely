"use client";

import { useState } from "react";
import { acceptQuoteAction } from "@/actions/acceptance";

/**
 * The client-facing accept form on a published quote.
 *
 * Only rendered when the quote includes a Statement of Work: accepting a bare
 * price estimate isn't meaningful, whereas an SOW sets out what is being
 * agreed to. Colours come from the template so it doesn't look bolted on.
 */
export function AcceptBlock({
  slug,
  accepted,
  accent,
  muted,
  dark,
}: {
  slug: string;
  accepted?: { name: string; at: string } | null;
  accent: string;
  muted?: string;
  dark?: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(accepted ?? null);

  const subtle = muted || "#565656";
  const fieldClass = dark
    ? "w-full bg-white/10 border border-white/25 rounded-lg px-3 py-2.5 text-[13px] outline-none"
    : "w-full bg-white border rounded-lg px-3 py-2.5 text-[13px] outline-none";

  if (done) {
    return (
      <div className="py-8" style={{ borderTop: `1px solid ${subtle}33` }}>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase mb-2">Accepted</div>
        <p className="text-[13.5px] m-0">
          Accepted by <strong>{done.name}</strong> on{" "}
          {new Date(done.at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          .
        </p>
        <p className="text-[12px] mt-1.5 m-0" style={{ color: subtle }}>
          A copy of this page is the record of that agreement.
        </p>
      </div>
    );
  }

  async function submit() {
    setError("");
    if (!agreed) {
      setError("Please tick the box to confirm you accept this quote.");
      return;
    }
    setSaving(true);
    const result = await acceptQuoteAction(slug, name, email);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone({ name: name.trim(), at: result.data.acceptedAt });
  }

  return (
    <div className="py-8" style={{ borderTop: `1px solid ${subtle}33` }}>
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase mb-1">Accept this quote</div>
      <p className="text-[13px] m-0 mb-4" style={{ color: subtle }}>
        Typing your name below and ticking the box records your acceptance of the scope, timeline
        and price set out on this page.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2.5 max-w-[420px]"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          autoComplete="name"
          className={fieldClass}
          style={dark ? undefined : { borderColor: `${subtle}44` }}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          type="email"
          autoComplete="email"
          className={fieldClass}
          style={dark ? undefined : { borderColor: `${subtle}44` }}
        />
        <label className="flex items-start gap-2.5 text-[12.5px] cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>I accept this quote and agree to the scope, timeline and price above.</span>
        </label>
        {error && (
          <div className="text-[12.5px]" style={{ color: "#D7263D" }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={saving}
          className="self-start font-body font-bold text-[13px] text-white rounded-lg px-5 py-3 mt-1 border-none cursor-pointer disabled:opacity-50"
          style={{ background: accent }}
        >
          {saving ? "Recording..." : "Accept quote"}
        </button>
      </form>
    </div>
  );
}
