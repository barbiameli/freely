"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { EditableBlock } from "@/components/editable-text";
import type { Dictionary } from "@/lib/i18n";

/**
 * One of the sentences Freely adds to the client's copy.
 *
 * "A milestone is a named set of deliverables..." and "A round of revisions is
 * one consolidated set of feedback...". They are appended when the quote is
 * rendered, so for a long time they existed on the document the client reads
 * and in no field the freelancer could reach. A definition that contradicted
 * the paragraph above it could not be corrected, only lived with.
 *
 * Showing it was the first fix and was not enough. It is their document going
 * to their client, so the wording is theirs: rewrite it, or take it out and
 * the quote says nothing on the subject.
 */
export function DefinitionLine({
  text,
  onSave,
  ariaLabel,
  t,
}: {
  /** The sentence as it currently stands. Empty means it has been removed. */
  text: string;
  /** A string rewords it. Null removes it. */
  onSave: (value: string | null) => void;
  ariaLabel: string;
  t: Dictionary;
}) {
  const [restoring, setRestoring] = useState(false);

  if (!text) {
    return (
      <button
        type="button"
        onClick={() => {
          setRestoring(true);
          // Undefined would be the right value, but null already means removed,
          // so an empty string is what asks for the standard wording back.
          onSave("");
          setRestoring(false);
        }}
        disabled={restoring}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet bg-none border-none cursor-pointer p-0 mt-2 tap"
      >
        <Plus size={12} />
        {t.brief.definitionRestore}
      </button>
    );
  }

  return (
    <div className="mt-2">
      <EditableBlock
        value={text}
        onSave={(next) => onSave(next.trim() ? next : null)}
        ariaLabel={ariaLabel}
        className="text-xs text-slate italic leading-relaxed"
      />
      <div className="flex items-center gap-3 mt-1 flex-wrap">
        <p className="text-xs text-text-muted m-0">{t.brief.autoAdded}</p>
        <button
          type="button"
          onClick={() => onSave(null)}
          className="text-xs font-semibold text-slate bg-none border-none cursor-pointer p-0 tap"
        >
          {t.brief.definitionRemove}
        </button>
      </div>
    </div>
  );
}
