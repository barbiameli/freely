"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Globe } from "lucide-react";
import { setPublishedAction } from "@/actions/diary";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { useT } from "@/lib/i18n/context";

/**
 * Whether the client can see this project, and where.
 *
 * This was a two-tab strip, Your work / What the client sees, and the second
 * tab was a whole second page: the updates, the deliverables again, and the
 * publish switch buried inside it. The updates have moved to the client, where
 * the person you are writing to is. What is left is the only part that was
 * ever about this project specifically, which is one switch and one address,
 * so it is one row rather than half the screen.
 */
export function ClientLink({
  projectId,
  published,
  publicSlug,
}: {
  projectId: string;
  published: boolean;
  publicSlug: string;
}) {
  const t = useT();
  const { run, pending } = useAction();
  const [copied, setCopied] = useState(false);

  const url = typeof window === "undefined" ? "" : `${window.location.origin}/p/${publicSlug}`;

  if (!published) {
    return (
      <Button
        variant="outline"
        size="sm"
        icon={Globe}
        loading={pending}
        data-guide="client"
        onClick={() => void run(() => setPublishedAction(projectId, true))}
      >
        {t.track.clientPageOpen}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <a
        href={`/p/${publicSlug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-body font-semibold text-meta text-link no-underline tap"
      >
        <Globe size={13} />
        {t.track.clientView}
        <ExternalLink size={12} />
      </a>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
        aria-label={t.portal.copy}
        className="text-text-muted hover:text-ink bg-none border-none cursor-pointer p-1 tap"
      >
        {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      </button>
    </div>
  );
}
