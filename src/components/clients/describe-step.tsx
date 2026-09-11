"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { draftBlocksAction } from "@/actions/portal";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { useT, useLocale } from "@/lib/i18n/context";

/**
 * The first step, and the one that does the work.
 *
 * Five headings and five empty boxes is a form, and a form about your own
 * working habits is the kind nobody finishes: everybody knows how they work
 * and almost nobody has ever written it down. Said out loud it takes one
 * breath. So this asks for the breath and files it under the headings, which
 * is the same move the quote form makes and the reason people finish one.
 *
 * It is a starting point rather than an answer. What comes back lands on the
 * next step with every word editable, and skipping this entirely still leaves
 * the catalogue and the pills that were here before.
 */
export function DescribeStep({
  clientId,
  hasWords,
  onWritten,
}: {
  clientId: string;
  /** Whether any step already has words in it, which this would replace. */
  hasWords: boolean;
  onWritten: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [said, setSaid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function write() {
    setBusy(true);
    setError("");
    const result = await draftBlocksAction(clientId, said, locale);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onWritten();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-slate m-0">{t.setup.describeHint}</p>

      <textarea
        value={said}
        onChange={(e) => setSaid(e.target.value)}
        rows={6}
        placeholder={t.setup.describePlaceholder}
        aria-label={t.setup.describeLabel}
        className="w-full bg-white border border-line rounded-sm px-3 py-2.5 text-small text-ink outline-none focus:border-violet resize-y"
      />

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <Button size="sm" icon={Sparkles} loading={busy} onClick={() => void write()}>
          {t.setup.write}
        </Button>
        {/* What it will and will not do, at the moment of pressing it. Said
            here rather than after, because both facts are the difference
            between reading what comes back and trusting it. */}
        <span className="text-caption text-text-muted flex-1 min-w-[180px]">
          {hasWords ? t.setup.describeReplaces : t.setup.describeYours}
        </span>
      </div>

      <ActionError error={error} />
    </div>
  );
}
