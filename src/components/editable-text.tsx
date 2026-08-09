"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";

/**
 * A block of generated text with an explicit Edit link and a Save button.
 *
 * The first version of this was click-to-edit with a pencil that only appeared
 * on hover, and saved silently on blur. Nobody could tell the text was
 * editable, which is the whole point of it being there. So: a visible "Edit"
 * link, a real textarea, and an explicit Save. Escape or Cancel backs out.
 *
 * `children` renders the read-only view, which can be richer than the raw text
 * (the timeline draws a roadmap from it, for instance). When omitted the raw
 * value is shown.
 */
export function EditableBlock({
  value,
  onSave,
  children,
  ariaLabel,
  hint,
  className,
  placeholder,
  singleLine,
}: {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  children?: ReactNode;
  ariaLabel?: string;
  /** Shown under the textarea while editing, e.g. "one stage per line". */
  hint?: string;
  className?: string;
  placeholder?: string;
  singleLine?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Regenerating or refining replaces the text underneath, so follow the
  // incoming value whenever we aren't mid-edit.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const end = ref.current.value.length;
      ref.current.setSelectionRange(end, end);
    }
  }, [editing]);

  async function commit() {
    const next = draft.trim();
    if (next === value.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(next);
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    const shared = {
      ref: ref as never,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
        setDraft(e.target.value),
      placeholder,
      "aria-label": ariaLabel,
      className:
        "w-full font-body text-[13.5px] text-ink leading-relaxed bg-white border border-violet rounded-lg px-3 py-2.5 outline-none",
    };
    return (
      <div>
        {singleLine ? (
          <input
            {...shared}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
          />
        ) : (
          <textarea
            {...shared}
            rows={Math.min(14, Math.max(3, draft.split("\n").length + 1))}
            onKeyDown={(e) => {
              // Enter makes a newline in a textarea, so Escape is the way out.
              if (e.key === "Escape") cancel();
            }}
          />
        )}
        {hint && <div className="text-[11px] text-text-muted mt-1">{hint}</div>}
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={commit}
            disabled={saving}
            className="font-body font-bold text-[12px] text-white bg-violet rounded-lg px-3.5 py-1.5 border-none cursor-pointer disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="text-[12px] text-text-muted bg-none border-none cursor-pointer p-0"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <div className={className}>{children ?? value}</div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-[11.5px] font-bold text-violet bg-none border-none cursor-pointer p-0 mt-2"
      >
        <Pencil size={11} /> Edit
      </button>
    </div>
  );
}
