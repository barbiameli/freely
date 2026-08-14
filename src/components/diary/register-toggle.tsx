"use client";

import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { setPlainLanguageAction, updateClientNameAction } from "@/actions/diary";
import { useAction } from "@/lib/use-action";
import { ActionError } from "@/components/ui/action-error";
import { Chip } from "@/components/ui/chip";
import { SubLabel } from "@/components/ui/label";
import { useT } from "@/lib/i18n/context";

export interface ClientLine {
  id: string;
  name: string;
  clientName: string | null;
  done: boolean;
}

/**
 * Technical or plain, for the client's page.
 *
 * The tracker's names are written for the person doing the work. "Swap font
 * from Inter to Sohne across all 13 text styles" has a definition of done in it,
 * which is what you want at 9am on a Tuesday and is not what a client is buying.
 * Some clients want exactly that detail, though: a technical lead reading a
 * vaguer line will assume you have not started.
 *
 * So it is a choice, per project, since one freelancer has both kinds of client.
 *
 * The plain version is written once and stored rather than generated on each
 * render, for two reasons. A client's page should not change wording between two
 * visits, and a line somebody corrected has to survive the toggle being flipped
 * off and on again.
 *
 * Every line is editable here, because this is the only screen where the two
 * versions sit next to each other and a bad rewrite is obvious.
 */
export function RegisterToggle({
  projectId,
  plainLanguage,
  lines,
}: {
  projectId: string;
  plainLanguage: boolean;
  lines: ClientLine[];
}) {
  const t = useT();
  const { run, pending, error } = useAction();
  const [plain, setPlain] = useState(plainLanguage);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function choose(next: boolean) {
    if (next === plain) return;
    // Optimistic, then reverted if the rewrite fails, since turning it on can
    // take a few seconds the first time.
    setPlain(next);
    const result = await run(() => setPlainLanguageAction(projectId, next));
    if (!result) setPlain(!next);
  }

  async function saveName(id: string) {
    const value = draft;
    setEditing(null);
    await run(() => updateClientNameAction(id, value));
  }

  return (
    <div className="mt-4 pt-4 border-t border-line">
      <SubLabel>{t.diary.registerLabel}</SubLabel>
      <div className="flex flex-wrap gap-1.5 mt-1">
        <Chip active={!plain} onClick={() => choose(false)}>
          {t.diary.registerTechnical}
        </Chip>
        <Chip active={plain} onClick={() => choose(true)}>
          {t.diary.registerPlain}
        </Chip>
      </div>
      <p className="text-caption text-text-muted mt-1.5 mb-0">
        {pending
          ? t.diary.registerWorking
          : plain
          ? t.diary.registerPlainHint
          : t.diary.registerTechnicalHint}
      </p>

      {/* What the client will read, in the order they will read it. Only when
          plain is on: with the technical names the tracker above is already
          the preview. */}
      {plain && lines.length > 0 && (
        <div className="mt-3 flex flex-col">
          {lines.map((line) => (
            <div
              key={line.id}
              className="flex items-start gap-2 py-1.5 border-b border-line/70 last:border-b-0"
            >
              {editing === line.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => saveName(line.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName(line.id);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="flex-1 font-body text-small text-ink bg-white border border-violet rounded-md px-2 py-1 outline-none"
                />
              ) : (
                <>
                  <span
                    className={`flex-1 text-small leading-snug ${
                      line.done ? "text-text-muted line-through" : "text-ink"
                    }`}
                  >
                    {line.clientName || line.name}
                  </span>
                  <button
                    type="button"
                    aria-label={t.common.edit}
                    onClick={() => {
                      setDraft(line.clientName || line.name);
                      setEditing(line.id);
                    }}
                    className="shrink-0 text-text-muted hover:text-violet bg-none border-none cursor-pointer p-0 tap mt-[3px]"
                  >
                    <Pencil size={11} />
                  </button>
                </>
              )}
            </div>
          ))}
          <p className="flex items-center gap-1 text-caption text-text-muted mt-2 mb-0">
            <Check size={11} /> {t.diary.registerEditable}
          </p>
        </div>
      )}

      <ActionError error={error} className="mt-2" />
    </div>
  );
}
