"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Eye, EyeOff } from "lucide-react";
import { removeBlockAction, setBlockAction, setShowInvoicesAction } from "@/actions/portal";
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
  showInvoices,
}: {
  clientId: string;
  saved: SavedBlock[];
  showInvoices: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const byKind = new Map(saved.map((block) => [block.kind, block]));
  const [openKind, setOpenKind] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { title: string; body: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <>
      <SectionHeading title={t.blocks.title} hint={t.blocks.hint} />
      <Card className="flex flex-col">
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
                  <span className="block text-caption text-text-muted">
                    {on && block?.body ? block.body.slice(0, 90) : spec.why}
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

        {/* Money, which is the one thing here somebody might not want shared
            at all. Beside the blocks because it is the same decision: what
            does this particular client get to see. */}
        <div className="flex items-start gap-3 pt-3.5 mt-1 border-t border-line">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await setShowInvoicesAction(clientId, !showInvoices);
              setBusy(false);
              router.refresh();
            }}
            aria-pressed={showInvoices}
            className="shrink-0 mt-0.5 text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 tap"
            aria-label={showInvoices ? t.blocks.hideInvoices : t.blocks.showInvoices}
          >
            {showInvoices ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <div className="min-w-0">
            <p className="font-body font-semibold text-small text-ink m-0">
              {showInvoices ? t.blocks.invoicesOn : t.blocks.invoicesOff}
            </p>
            <p className="text-caption text-text-muted mt-0.5 mb-0">{t.blocks.invoicesHint}</p>
          </div>
        </div>

        <ActionError error={error} />
      </Card>
    </>
  );
}
