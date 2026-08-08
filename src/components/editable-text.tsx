"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

/**
 * Click-to-edit text that saves on blur.
 *
 * Re-prompting the AI to change one word is slow, costs a generation, and can
 * rewrite the parts you were already happy with. Anything client-facing is
 * therefore editable in place: click, type, click away.
 *
 * Deliberately not a form with a Save button. The thing being edited is
 * usually a single sentence, and a modal or an explicit save step for that
 * makes small corrections feel more expensive than they are.
 */
export function EditableText({
  value,
  onSave,
  multiline,
  className,
  placeholder,
  ariaLabel,
}: {
  value: string;
  /** Called only when the text actually changed. */
  onSave: (next: string) => void | Promise<void>;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Regenerating or refining replaces the text underneath us, so track the
  // incoming value whenever we aren't mid-edit.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next !== value.trim()) onSave(next);
  }

  if (editing) {
    const shared = {
      ref: inputRef as never,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      "aria-label": ariaLabel,
      className: `w-full bg-white border border-violet rounded-lg px-2.5 py-2 outline-none font-body ${
        className || ""
      }`,
    };
    return multiline ? (
      <textarea
        {...shared}
        rows={Math.min(12, Math.max(3, draft.split("\n").length + 1))}
        onKeyDown={(e) => {
          // Enter inserts a newline here, so Escape is the way out.
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    ) : (
      <input
        {...shared}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to edit"
      className={`group text-left w-full bg-none border-none cursor-text p-0 whitespace-pre-wrap ${
        className || ""
      }`}
    >
      {value || <span className="text-text-muted">{placeholder || "Click to add"}</span>}
      <Pencil
        size={11}
        className="inline-block ml-1.5 mb-0.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </button>
  );
}
