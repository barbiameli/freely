"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteBriefAction } from "@/actions/briefs";
import { useT } from "@/lib/i18n/context";
import type { BriefSummary } from "@/components/brief-card";

/**
 * Deletes a draft quote.
 *
 * Only offered on drafts: a tracked quote has a project hanging off it, and
 * losing the tracked work as a side effect of tidying up the quote list would
 * be a nasty surprise. Confirmation is inline rather than a browser dialog,
 * so the click that deletes is a deliberate second one.
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

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-meta bg-white/95 border border-line rounded-md px-1.5 py-1">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteBriefAction(brief.id);
              if (result.ok) {
                router.refresh();
              } else {
                setError(result.error);
                setConfirming(false);
              }
            })
          }
          className="font-semibold text-overdue bg-none border-none cursor-pointer p-0 tap disabled:opacity-50"
        >
          {pending ? t.common.deleting : t.common.delete}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-text-muted bg-none border-none cursor-pointer p-0 tap"
        >
          {t.common.keep}
        </button>
      </span>
    );
  }

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
        {label && "Delete"}
      </button>
      {error && <span className="text-overdue text-caption">{error}</span>}
    </span>
  );
}
