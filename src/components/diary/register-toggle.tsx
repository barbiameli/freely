"use client";

import { useState } from "react";
import { Pencil, Loader2, ArrowRight, Check } from "lucide-react";
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
 * The tracker's names are written for the person doing the work. "Swap font from
 * Inter to Sohne across all 13 text styles" has a definition of done in it,
 * which is what you want at 9am on a Tuesday and is not what a client is buying.
 * Some clients want exactly that detail, though: a technical lead reading a
 * vaguer line will assume you have not started. So it is a choice, per project.
 *
 * The first version of this had three problems and all three were the same
 * problem: nothing on screen showed what it did.
 *
 * It sat at the foot of the tracker card, so it was found by accident. It is
 * here now, above the entries, with the other control that changes what a client
 * reads.
 *
 * Turning it on can take a few seconds while the lines are rewritten, and it
 * said nothing, so it looked broken. It says what it is doing now, and the
 * chips are unclickable while it happens.
 *
 * And with it off there was nothing to see at all, because the rewritten names
 * only appear on the client's page. Both versions are shown side by side now,
 * so the choice is a comparison rather than a guess.
 *
 * What it does not touch is the tracker. Those are your working names and the
 * point is that they can stay blunt.
 */
export function RegisterToggle({
  projectId,
  plainLanguage,
  lines,
  publicSlug,
  published,
}: {
  projectId: string;
  plainLanguage: boolean;
  lines: ClientLine[];
  /** For the link that lets somebody check the result themselves. */
  publicSlug?: string | null;
  published?: boolean;
}) {
  const t = useT();
  const { run, pending, error } = useAction();
  const [plain, setPlain] = useState(plainLanguage);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Said out loud after a switch. Without it the only confirmation was the chip
  // staying where it was put, which is indistinguishable from nothing happening.
  const [saved, setSaved] = useState(false);

  async function choose(next: boolean) {
    if (next === plain || pending) return;
    setPlain(next);
    const result = await run(() => setPlainLanguageAction(projectId, next));
    // Put it back if the rewrite failed, rather than showing a state that was
    // never saved. This read `if (!result)` and the action returns no data, so
    // every success looked like a failure and the toggle flipped itself back.
    if (!result.ok) {
      setPlain(!next);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function saveName(id: string) {
    const value = draft;
    setEditing(null);
    await run(() => updateClientNameAction(id, value));
  }

  const rewritten = lines.filter((line) => line.clientName);

  return (
    <div className="rounded-lg border border-line bg-paper px-4 py-3.5 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubLabel className="mb-0">{t.diary.registerLabel}</SubLabel>
        {pending ? (
          <span className="flex items-center gap-1.5 text-caption text-violet">
            <Loader2 size={11} className="animate-spin-slow" />
            {t.diary.registerWorking}
          </span>
        ) : saved ? (
          <span className="flex items-center gap-1.5 text-caption text-success">
            <Check size={11} /> {t.diary.registerSaved}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        <Chip active={!plain} onClick={() => choose(false)}>
          {t.diary.registerTechnical}
        </Chip>
        <Chip active={plain} onClick={() => choose(true)}>
          {t.diary.registerPlain}
        </Chip>
      </div>

      <p className="text-caption text-text-muted mt-2 mb-0">
        {plain ? t.diary.registerPlainHint : t.diary.registerTechnicalHint}
      </p>

      {/* Both versions, side by side, whichever is selected. With the old
          version you could only see the effect by opening the client's page in
          another tab, which is not a way to make a decision. The selected side
          is the one in ink. */}
      {rewritten.length > 0 && (
        <div className="mt-3 pt-3 border-t border-line flex flex-col">
          {rewritten.map((line) => (
            <div key={line.id} className="py-1.5 border-b border-line/60 last:border-b-0">
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
                  className="w-full font-body text-small text-ink bg-white border border-violet rounded-md px-2 py-1 outline-none"
                />
              ) : (
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={`text-caption ${plain ? "text-text-muted line-through" : "text-ink"}`}
                    >
                      {line.name}
                    </span>
                    <ArrowRight size={10} className="text-text-muted shrink-0 self-center" />
                    <span
                      className={`text-caption ${plain ? "text-ink font-semibold" : "text-text-muted"}`}
                    >
                      {line.clientName}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={t.common.edit}
                    onClick={() => {
                      setDraft(line.clientName || line.name);
                      setEditing(line.id);
                    }}
                    className="shrink-0 text-text-muted hover:text-violet bg-none border-none cursor-pointer p-0 tap mt-[2px]"
                  >
                    <Pencil size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
            <p className="text-caption text-text-muted m-0">{t.diary.registerEditable}</p>
            {/* So the result can be checked rather than trusted. The page is
                rendered fresh on every request, so it is already current. */}
            {published && publicSlug && (
              <a
                href={`/p/${publicSlug}`}
                target="_blank"
                rel="noreferrer"
                className="text-caption font-semibold text-violet no-underline tap"
              >
                {t.diary.registerSeePage}
              </a>
            )}
          </div>
        </div>
      )}

      <ActionError error={error} className="mt-2" />
    </div>
  );
}
