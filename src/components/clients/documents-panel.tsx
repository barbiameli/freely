"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Paperclip, PenLine, Trash2, Upload, X } from "lucide-react";
import {
  deleteDocumentAction,
  renameDocumentAction,
  uploadDocumentAction,
} from "@/actions/documents";
import { DOCUMENT_EMOJI } from "@/lib/document-emoji";
import { ActionError } from "@/components/ui/action-error";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/page-header";
import { useT } from "@/lib/i18n/context";

export interface ClientDocument {
  id: string;
  name: string;
  contentType: string;
  size: number;
  note: string;
  emoji: string;
}

/** "3.2 MB", or "812 KB" under a megabyte. Nobody wants the byte count. */
function saySize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * The files the client sees, managed from your side.
 *
 * A table rather than a grid of tiles: these are documents with names and
 * dates, and a person looking for the brand guide is reading a list rather
 * than recognising a thumbnail.
 */
export function DocumentsPanel({
  clientId,
  documents,
}: {
  clientId: string;
  documents: ClientDocument[];
}) {
  const t = useT();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    note: string;
    emoji: string;
  } | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("file", file);
    const result = await uploadDocumentAction(clientId, form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    const result = await renameDocumentAction(
      editing.id,
      editing.name,
      editing.note,
      editing.emoji
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    const result = await deleteDocumentAction(id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <SectionHeading title={t.docs.title} hint={t.docs.hint} />
      <Card className="flex flex-col gap-3">
        {documents.length === 0 ? (
          <p className="text-small text-slate m-0">{t.docs.empty}</p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-start gap-3 py-2.5 border-b border-line last:border-b-0"
              >
                <span className="shrink-0 w-5 text-center mt-0.5 text-body" aria-hidden>
                  {doc.emoji || (
                    <Paperclip size={14} className="text-text-muted inline align-middle" />
                  )}
                </span>

                {editing?.id === doc.id ? (
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <input
                      autoFocus
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      aria-label={t.docs.nameLabel}
                      className="w-full bg-paper rounded-sm border-none px-2 py-1.5 text-small text-ink outline-none"
                    />
                    <input
                      value={editing.note}
                      onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                      placeholder={t.docs.notePlaceholder}
                      aria-label={t.docs.noteLabel}
                      className="w-full bg-paper rounded-sm border-none px-2 py-1.5 text-caption text-slate outline-none"
                    />
                    {/* The set, as buttons. A picker behind a popover for
                        twelve characters is a menu to open in order to press
                        one thing. */}
                    <div className="flex flex-wrap gap-1">
                      {DOCUMENT_EMOJI.map((glyph) => (
                        <button
                          key={glyph || "none"}
                          type="button"
                          onClick={() => setEditing({ ...editing, emoji: glyph })}
                          aria-label={glyph || t.docs.noEmoji}
                          aria-pressed={editing.emoji === glyph}
                          className={`w-7 h-7 rounded-sm border cursor-pointer text-small flex items-center justify-center ${
                            editing.emoji === glyph
                              ? "border-violet bg-violet-tint"
                              : "border-line bg-white"
                          }`}
                        >
                          {glyph || <X size={11} className="text-text-muted" />}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveEdit()}
                        aria-label={t.common.save}
                        className="text-success bg-none border-none cursor-pointer p-1 tap"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        aria-label={t.common.cancel}
                        className="text-text-muted bg-none border-none cursor-pointer p-1 tap"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      {/* The name opens it, the pencil renames it. Clicking a
                          file to edit its title rather than to read it was
                          the wrong way round on the one screen where you are
                          checking what the client will actually see. */}
                      <a
                        href={`/api/documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-body font-semibold text-small text-ink truncate no-underline hover:text-link"
                      >
                        {doc.name}
                      </a>
                      {doc.note && (
                        <span className="block text-caption text-slate truncate">{doc.note}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          id: doc.id,
                          name: doc.name,
                          note: doc.note,
                          emoji: doc.emoji,
                        })
                      }
                      aria-label={t.docs.rename}
                      className="text-text-muted hover:text-ink bg-none border-none cursor-pointer p-1 tap shrink-0"
                    >
                      <PenLine size={14} />
                    </button>
                    <span className="font-label text-caption text-text-muted tabular-nums shrink-0 mt-0.5">
                      {saySize(doc.size)}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(doc.id)}
                      aria-label={t.common.delete}
                      className="text-text-muted hover:text-overdue bg-none border-none cursor-pointer p-1 tap shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div>
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              // Cleared, so choosing the same file twice in a row still fires
              // a change event.
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-2 font-body font-bold text-meta text-ink bg-white border-[1.5px] border-ink rounded-full px-4 py-2 cursor-pointer press disabled:opacity-60 hover:bg-ink hover:text-white transition-colors"
          >
            <Upload size={14} />
            {busy ? t.docs.uploading : t.docs.add}
          </button>
          {/* Said where the files are added. The store is private, so this is
              a statement about who can reach them rather than a warning. */}
          <p className="text-caption text-text-muted mt-2 mb-0">{t.docs.privacy}</p>
        </div>

        <ActionError error={error} />
      </Card>
    </>
  );
}
