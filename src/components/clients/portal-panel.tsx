"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, ExternalLink, Sparkles } from "lucide-react";
import { setPortalPublishedAction } from "@/actions/portal";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/label";
import { useT } from "@/lib/i18n/context";
import { PortalSetup } from "@/components/clients/portal-setup";
import type { SavedBlock } from "@/components/clients/blocks-panel";
import type { PortalSettings } from "@/components/clients/portal-setup";
import type { PortalPerson } from "@/components/clients/access-panel";
import type { ClientDocument } from "@/components/clients/documents-panel";
import type { UpdatableProject } from "@/components/clients/updates-panel";

/**
 * The client's front door, from your side.
 *
 * Two states and they look different on purpose. Before there is a portal
 * this is a prompt: what the thing is, and one button that makes it. After,
 * it is the address plus the pack, because at that point the question is no
 * longer "should I" but "what does it say".
 *
 * What the client is actually told lives in the blocks panel below this now.
 * This is the address and the switch, which is all that is left once the words
 * have somewhere better to be.
 */
export function PortalPanel({
  clientId,
  clientName,
  publicSlug,
  published,
  blocks,
  settings,
  people,
  documents,
  projects,
}: {
  clientId: string;
  clientName: string;
  publicSlug: string;
  published: boolean;
  blocks: SavedBlock[];
  settings: PortalSettings;
  people: PortalPerson[];
  documents: ClientDocument[];
  projects: UpdatableProject[];
}) {
  const t = useT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);

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
    // Straight into setting it up. Making the page and deciding what it says
    // are one intention, and they were two screens apart.
    if (next) setSetupOpen(true);
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

        <PortalSetup
          open={setupOpen}
          onClose={() => setSetupOpen(false)}
          clientId={clientId}
          publicSlug={publicSlug}
          blocks={blocks}
          settings={settings}
          people={people}
          documents={documents}
          projects={projects}
        />
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

      {/* Their page, from their side, without a second account and without a
          dummy client to keep in step with the real one. Signed in as the
          owner, so it shows exactly what is actually there. */}
      <div className="flex flex-wrap items-center gap-2.5 mt-3">
        <a
          href={`/c/${publicSlug}?preview=1&welcome=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-body font-bold text-meta text-ink bg-white border-[1.5px] border-ink rounded-full px-4 py-2 no-underline press hover:bg-ink hover:text-white transition-colors"
        >
          <Eye size={14} />
          {t.portal.previewWelcome}
        </a>
        <a
          href={`/c/${publicSlug}?preview=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body font-semibold text-meta text-link no-underline tap"
        >
          {t.portal.previewDashboard}
        </a>
      </div>

      <div className="flex items-center gap-2.5 mt-3.5 flex-wrap">
        {/* Off is a real off switch: the page stops resolving, and so does
            every document reachable through it, for everybody already holding
            the address. */}
        <Button size="sm" onClick={() => setSetupOpen(true)}>
          {t.portal.editWhatTheySee}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void publish(false)} disabled={saving}>
          {t.portal.turnOff}
        </Button>
      </div>

      <ActionError error={error} />

      <PortalSetup
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        clientId={clientId}
        publicSlug={publicSlug}
        blocks={blocks}
        settings={settings}
        people={people}
        documents={documents}
        projects={projects}
      />
    </Card>
  );
}
