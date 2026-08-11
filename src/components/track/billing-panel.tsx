"use client";

import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import { useAction } from "@/lib/use-action";
import { currencySymbol } from "@/lib/currencies";
import { invoiceProjectAction, setBillingModeAction } from "@/actions/invoices";
import { billable, type BillingMode, type QueueProject } from "@/lib/invoice-queue";
import { useT } from "@/lib/i18n/context";
import { fill } from "@/lib/i18n";

/**
 * How this project bills, and what is billable on it right now.
 *
 * The prompt is a standing panel rather than something that appears when a
 * deliverable is ticked. A prompt at the moment of ticking is easy to miss and
 * gone if you do: you tick three things in a row, dismiss the third, and the
 * money is invisible again. This stays until the work is billed, which is the
 * behaviour that actually stops an invoice being forgotten.
 */
export function BillingPanel({
  project,
  invoiceCount,
}: {
  project: QueueProject;
  invoiceCount: number;
}) {
  const t = useT();
  const router = useRouter();
  const { run, pending, error } = useAction();

  const entry = billable({ ...project, invoiceCount });
  const ready = entry.lines.length > 0;

  async function invoice() {
    const created = await run(() => invoiceProjectAction(project.id), { skipRefresh: true });
    if (created) router.push(`/invoices/${created.invoiceId}`);
  }

  return (
    <Card className={ready ? "border-violet border-[1.5px]" : undefined}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-caption font-bold text-slate uppercase tracking-wide">
            {t.invoices.billing}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(
              [
                ["ON_COMPLETION", t.invoices.onCompletion],
                ["PER_MILESTONE", t.invoices.perMilestone],
              ] as [BillingMode, string][]
            ).map(([mode, label]) => (
              <Chip
                key={mode}
                active={project.billing === mode}
                onClick={() => run(() => setBillingModeAction(project.id, mode))}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>

        {ready && (
          <div className="text-right">
            <div className="font-body font-bold text-title text-ink tabular-nums">
              {currencySymbol(project.currency)}
              {entry.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-caption text-text-muted">
              {fill(t.invoices.readyToBill, { count: entry.lines.length })}
            </div>
          </div>
        )}
      </div>

      {ready && (
        <div className="mt-3 pt-3 border-t border-line">
          <div className="flex flex-col gap-1.5">
            {entry.lines.map((line) => (
              <div key={line.title} className="flex items-baseline justify-between gap-3">
                <span className="text-small text-slate min-w-0 truncate">{line.title}</span>
                <span className="text-caption text-ink tabular-nums shrink-0">
                  {currencySymbol(project.currency)}
                  {line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Button icon={FileText} onClick={invoice} disabled={pending}>
              {pending ? t.common.working : t.invoices.invoiceIt}
            </Button>
          </div>
        </div>
      )}

      {!ready && entry.notReady === "in-progress" && (
        <p className="text-caption text-text-muted mt-2 mb-0">{t.invoices.finishToInvoice}</p>
      )}
      {!ready && entry.notReady === "already-invoiced" && (
        <p className="text-caption text-text-muted mt-2 mb-0">{t.invoices.allBilled}</p>
      )}

      <ActionError error={error} className="mt-2" />
    </Card>
  );
}
