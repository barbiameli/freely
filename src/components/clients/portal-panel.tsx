"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import { setPortalPublishedAction, setWelcomePackAction } from "@/actions/portal";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/label";
import { useT } from "@/lib/i18n/context";
import { WelcomeBuilder } from "@/components/clients/welcome-builder";

/**
 * The client's front door, from your side.
 *
 * Two states and they look different on purpose. Before there is a portal
 * this is a prompt: what the thing is, and one button that makes it. After,
 * it is the address plus the pack, because at that point the question is no
 * longer "should I" but "what does it say".
 *
 * The pack is the part worth nagging about. A portal with a link and no words
 * is a folder, and the reason to send one at all is that the first week of a
 * project is when a client has the most questions and the least idea whether
 * asking them is reasonable.
 */
export function PortalPanel({
  clientId,
  clientName,
  publicSlug,
  published,
  welcomePack,
  onboarding,
  fallbackPack,
}: {
  clientId: string;
  clientName: string;
  publicSlug: string;
  published: boolean;
  welcomePack: string | null;
  /** The answers behind the pack, so the questions can be re-opened. */
  onboarding: Record<string, string>;
  /** What the account says, used when this client has nothing of their own. */
  fallbackPack: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [pack, setPack] = useState(welcomePack ?? "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const url = typeof window === "undefined" ? "" : `${window.location.origin}/c/${publicSlug}`;

  async function publish(next: boolean) {
    setSaving(true);
    setError("");
    const result = await setPortalPublishedAction(clientId, next);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function savePack() {
    setSaving(true);
    setError("");
    const result = await setWelcomePackAction(clientId, pack);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!published) {
    return (
      <Card className="border-violet/30 border-[1.5px]">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet" />
              {t.portal.makeTitle}
            </span>
          }
          hint={<>{t.portal.makeHint.replace("{name}", clientName)}</>}
        />
        <div className="mt-4">
          <Button onClick={() => void publish(true)} loading={saving}>
            {t.portal.make}
          </Button>
        </div>
        <ActionError error={error} />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={<>{t.portal.title}</>} hint={<>{t.portal.hint}</>} />

      <div className="flex items-center gap-2 mt-4 bg-paper rounded-sm px-3 py-2.5">
        <span className="font-label text-caption text-slate truncate flex-1 min-w-0">
          {url || `/c/${publicSlug}`}
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          }}
          aria-label={t.portal.copy}
          className="text-text-muted hover:text-ink bg-none border-none cursor-pointer p-1 tap shrink-0"
        >
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
        </button>
        <a
          href={`/c/${publicSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.portal.open}
          className="text-text-muted hover:text-ink p-1 tap shrink-0"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      {/* The questions first, then what they produced. Somebody arriving at a
          blank textarea called "What happens next" writes nothing; somebody
          asked how many rounds of revisions they do has an answer. */}
      <div className="mt-5 border-t border-line pt-4">
        <WelcomeBuilder
          clientId={clientId}
          answers={onboarding}
          onDrafted={(text) => setPack(text)}
        />
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="text-caption text-text-muted mb-1">{t.portal.packLabel}</div>
        <textarea
          value={pack}
          onChange={(e) => setPack(e.target.value)}
          rows={5}
          placeholder={fallbackPack ?? t.portal.packPlaceholder}
          aria-label={t.portal.packLabel}
          className="w-full bg-white border border-line rounded-sm px-3 py-2.5 text-small text-ink outline-none focus:border-violet resize-y"
        />
        <p className="text-caption text-text-muted mt-1.5 mb-0">
          {fallbackPack ? t.portal.packFallback : t.portal.packEmpty}
        </p>
      </div>

      <div className="flex items-center gap-2.5 mt-3.5 flex-wrap">
        <Button size="sm" onClick={() => void savePack()} loading={saving}>
          {t.common.save}
        </Button>
        {/* Off is a real off switch: the page stops resolving, and so does
            every document reachable through it, for everybody already holding
            the address. */}
        <Button size="sm" variant="ghost" onClick={() => void publish(false)} disabled={saving}>
          {t.portal.turnOff}
        </Button>
      </div>

      <ActionError error={error} />
    </Card>
  );
}
