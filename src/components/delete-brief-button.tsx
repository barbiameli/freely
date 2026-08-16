"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteBriefAction } from "@/actions/briefs";
import { Confirm } from "@/components/ui/confirm";
import { useT } from "@/lib/i18n/context";
import type { BriefSummary } from "@/components/brief-card";

/**
 * Deletes a draft quote.
 *
 * Only offered on drafts: a tracked quote has a project hanging off it, and
 * losing the tracked work as a side effect of tidying up the quote list would
 * be a nasty surprise. It asks first, through the same dialog every other
 * delete in the app uses, and names the draft so the second click is about a
 * specific thing rather than about a button.
 */
export function DeleteBriefButton({
  brief,
  label = false,
}: {
  brief: Pick<BriefSummary, "id" | "title" | "status">;
  /** Shows the word "Delete" alongside the icon, for roomier layouts. */
  label?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  if (brief.status === "TRACKED") return null;

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setError("");
          setConfirming(true);
        }}
        aria-label={`${t.common.delete} ${brief.title}`}
        title={t.quote.deleteThisDraft}
        className="flex items-center gap-1 text-meta text-text-muted hover:text-overdue bg-white/90 border border-line rounded-md px-1.5 py-1 cursor-pointer backdrop-blur-sm"
      >
        <Trash2 size={12} />
        {label && t.common.delete}
      </button>

      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          startTransition(async () => {
            const result = await deleteBriefAction(brief.id);
            setConfirming(false);
            if (result.ok) router.refresh();
            else setError(result.error);
          })
        }
        working={pending}
        title={t.common.confirmDeleteDraft}
        confirmLabel={t.common.confirmDeleteDraftAction}
      >
        <p className="text-small text-ink m-0 font-semibold text-pretty">{brief.title}</p>
      </Confirm>
      {error && <span className="text-overdue text-caption">{error}</span>}
    </span>
  );
}
