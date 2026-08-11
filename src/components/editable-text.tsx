"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { useT } from "@/lib/i18n/context";

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
  tone = "light",
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
  /** "dark" for placement on the ink hero, where violet on near-black fails
   * contrast. */
  tone?: "light" | "dark";
}) {
  const t = useT();
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
        "w-full font-body text-body text-ink leading-relaxed bg-white border border-violet rounded-lg px-3 py-2.5 outline-none",
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
        {hint && <div className="text-caption text-text-muted mt-1">{hint}</div>}
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={commit}
            disabled={saving}
            className="font-body font-bold text-meta text-white bg-violet rounded-lg px-3.5 py-1.5 border-none cursor-pointer disabled:opacity-50"
          >
            {saving ? t.common.saving : t.common.save}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="text-meta text-text-muted bg-none border-none cursor-pointer p-0"
          >
            {t.common.cancel}
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
        className={`flex items-center gap-1 text-meta font-bold bg-none border-none cursor-pointer p-0 mt-2 ${
          tone === "dark" ? "text-white/70 hover:text-white" : "text-violet"
        }`}
      >
        <Pencil size={11} /> {t.common.edit}
      </button>
    </div>
  );
}

/**
 * One Edit link for a section made of several fields.
 *
 * A quote section is usually a group: the overview is a title, a client, a
 * price and hours; strategy is a goal plus findings. Giving each of those its
 * own Edit link produced a page covered in them. This opens the whole group at
 * once and saves it in one go.
 */
export interface EditableField {
  key: string;
  label: string;
  value: string;
  multiline?: boolean;
  hint?: string;
  /** Numeric fields get a number input and are validated before saving. */
  numeric?: boolean;
}

export function EditableSection({
  fields,
  onSave,
  children,
  tone = "light",
  editLabel = "Edit",
}: {
  fields: EditableField[];
  onSave: (values: Record<string, string>) => void | Promise<void>;
  children: ReactNode;
  tone?: "light" | "dark";
  editLabel?: string;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function open() {
    setDraft(Object.fromEntries(fields.map((f) => [f.key, f.value])));
    setError("");
    setEditing(true);
  }

  async function commit() {
    for (const field of fields) {
      if (field.numeric) {
        const n = Number(draft[field.key]);
        if (!Number.isFinite(n) || n < 0) {
          setError(`${field.label} needs to be a number.`);
          return;
        }
      }
    }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div>
        {children}
        <button
          type="button"
          onClick={open}
          className={`flex items-center gap-1 text-meta font-bold bg-none border-none cursor-pointer p-0 mt-3 ${
            tone === "dark" ? "text-white/75 hover:text-white" : "text-violet"
          }`}
        >
          <Pencil size={11} /> {editLabel}
        </button>
      </div>
    );
  }

  const inputClass =
    "w-full font-body text-body text-ink leading-relaxed bg-white border border-violet rounded-lg px-3 py-2.5 outline-none";

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <label key={field.key} className="block">
          <span
            className={`block text-caption font-bold uppercase tracking-wide mb-1 ${
              tone === "dark" ? "text-white/60" : "text-slate"
            }`}
          >
            {field.label}
          </span>
          {field.multiline ? (
            <textarea
              value={draft[field.key] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
              rows={Math.min(14, Math.max(3, (draft[field.key] ?? "").split("\n").length + 1))}
              className={inputClass}
            />
          ) : (
            <input
              value={draft[field.key] ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
              type={field.numeric ? "number" : "text"}
              className={inputClass}
            />
          )}
          {field.hint && <span className="block text-caption text-text-muted mt-1">{field.hint}</span>}
        </label>
      ))}
      {error && <div className="text-overdue text-meta">{error}</div>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={commit}
          disabled={saving}
          className="font-body font-bold text-meta text-white bg-violet rounded-lg px-3.5 py-1.5 border-none cursor-pointer disabled:opacity-50"
        >
          {saving ? t.common.saving : t.common.save}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className={`text-meta bg-none border-none cursor-pointer p-0 ${
            tone === "dark" ? "text-white/60" : "text-text-muted"
          }`}
        >
          {t.common.cancel}
        </button>
      </div>
    </div>
  );
}
