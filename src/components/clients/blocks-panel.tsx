"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus } from "lucide-react";
import { removeBlockAction, setBlockAction } from "@/actions/portal";
import { BLOCKS } from "@/lib/onboarding-blocks";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/page-header";
import { useT } from "@/lib/i18n/context";

export interface SavedBlock {
  kind: string;
  title: string;
  body: string;
}

/**
 * What this client gets told, and in what order.
 *
 * The catalogue is the list; a switch decides whether each one is included.
 * Order is not offered, because it is the order these things happen in and
 * choosing it is not a real decision: hello, sign the thing, how I work, when
 * I am about, where to find me.
 *
 * Per client rather than per account, because that is the request: the same
 * freelancer says different things to a startup they Slack all day and to a
 * legal team who need the contract paragraph. What is shared is the catalogue
 * and the wording somebody last used, not the selection.
 */
export function BlocksPanel({
  clientId,
  saved,
  bare,
}: {
  clientId: string;
  saved: SavedBlock[];
  /** Inside a dialog, which brings its own heading and card. */
  bare?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const byKind = new Map(saved.map((block) => [block.kind, block]));
  const [openKind, setOpenKind] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { title: string; body: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /*
   * Saved as you go rather than per block.
   *
   * Inside a modal there is nowhere sensible to put five Save buttons, and a
   * single one at the bottom means somebody who closes the dialog after
   * writing three paragraphs loses all three.
   */
  async function include(kind: string, on: boolean) {
    setBusy(true);
    setError("");
    const spec = BLOCKS.find((block) => block.kind === kind);
    const result = on
      ? await setBlockAction(clientId, kind, spec?.title ?? "", "")
      : await removeBlockAction(clientId, kind);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (on) setOpenKind(kind);
    router.refresh();
  }

  async function save(kind: string) {
    const draft = drafts[kind];
    if (!draft) return;
    setBusy(true);
    setError("");
    const result = await setBlockAction(clientId, kind, draft.title, draft.body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpenKind(null);
    router.refresh();
  }

  const rows = (
    <>
        {BLOCKS.map((spec) => {
          const block = byKind.get(spec.kind);
          const on = Boolean(block);
          const open = openKind === spec.kind;
          const draft = drafts[spec.kind] ?? {
            title: block?.title ?? spec.title,
            body: block?.body ?? "",
          };

          return (
            <div key={spec.kind} className="border-b border-line last:border-b-0 py-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void include(spec.kind, !on)}
                  aria-pressed={on}
                  aria-label={on ? t.blocks.leaveOut : t.blocks.include}
                  className={`shrink-0 mt-0.5 w-5 h-5 rounded-sm flex items-center justify-center cursor-pointer border ${
                    on ? "bg-violet border-violet" : "bg-white border-line"
                  }`}
                >
                  {on && <Check size={13} strokeWidth={3} className="text-ink" />}
                </button>

                <button
                  type="button"
                  onClick={() => setOpenKind(open ? null : spec.kind)}
                  aria-expanded={open}
                  className="min-w-0 flex-1 text-left bg-none border-none cursor-pointer p-0 tap-row"
                >
                  <span className="block font-body font-semibold text-small text-ink">
                    {block?.title ?? spec.title}
                  </span>
                  {/* The words themselves once there are any, wrapped to three
                      lines rather than cut at 90 characters. These arrive
                      written now, and a step somebody is meant to check
                      should be readable without opening it. */}
                  <span
                    className={`block text-caption text-text-muted ${
                      on && block?.body ? "line-clamp-3 mt-0.5" : ""
                    }`}
                  >
                    {on && block?.body ? block.body : spec.why}
                  </span>
                </button>

                {on && (
                  <ChevronDown
                    size={14}
                    className={`text-text-muted shrink-0 mt-1 transition-transform ${
                      open ? "" : "-rotate-90"
                    }`}
                    aria-hidden
                  />
                )}
              </div>

              {on && open && (
                <div className="mt-3 pl-8 flex flex-col gap-2">
                  <input
                    value={draft.title}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [spec.kind]: { ...draft, title: e.target.value } })
                    }
                    aria-label={t.blocks.heading}
                    className="w-full bg-white border border-line rounded-sm px-3 py-2 text-small font-semibold text-ink outline-none focus:border-violet"
                  />
                  {/* Pressed, they land in the box. Appended rather than
                      swapped in, so three presses make a paragraph, and the
                      whole cost of writing one of these is starting. */}
                  <div className="flex flex-wrap gap-1.5">
                    {spec.pills.map((pill) => {
                      const already = draft.body.includes(pill);
                      return (
                        <button
                          key={pill}
                          type="button"
                          disabled={already}
                          onClick={() =>
                            setDrafts({
                              ...drafts,
                              [spec.kind]: {
                                ...draft,
                                body: draft.body.trim()
                                  ? `${draft.body.trim()} ${pill}`
                                  : pill,
                              },
                            })
                          }
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-caption cursor-pointer border transition-colors ${
                            already
                              ? "border-line bg-paper text-text-muted cursor-default"
                              : "border-line bg-white text-slate hover:border-ink"
                          }`}
                        >
                          {already ? (
                            <Check size={11} className="text-success" />
                          ) : (
                            <Plus size={11} />
                          )}
                          {pill}
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    value={draft.body}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [spec.kind]: { ...draft, body: e.target.value } })
                    }
                    rows={4}
                    placeholder={spec.placeholder}
                    aria-label={t.blocks.words}
                    className="w-full bg-white border border-line rounded-sm px-3 py-2.5 text-small text-ink outline-none focus:border-violet resize-y"
                  />
                  <div>
                    <Button size="sm" loading={busy} onClick={() => void save(spec.kind)}>
                      {t.common.save}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

      <ActionError error={error} />
    </>
  );

  if (bare) return <div className="flex flex-col">{rows}</div>;
  return (
    <>
      <SectionHeading title={t.blocks.title} hint={t.blocks.hint} />
      <Card className="flex flex-col">{rows}</Card>
    </>
  );
}
