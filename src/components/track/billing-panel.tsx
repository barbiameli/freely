"use client";

import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import { useAction } from "@/lib/use-action";
import { currencySymbol } from "@/lib/currencies";
import { invoiceProjectAction } from "@/actions/invoices";
import { billable, type QueueProject } from "@/lib/invoice-queue";
import { useT } from "@/lib/i18n/context";
import { fill } from "@/lib/i18n";
import { SubLabel } from "@/components/ui/label";

/**
 * What is billable on this project right now.
 *
 * The prompt is a standing panel rather than something that appears when a
 * deliverable is ticked. A prompt at the moment of ticking is easy to miss and
 * gone if you do: you tick three things in a row, dismiss the third, and the
 * money is invisible again. This stays until the work is billed, which is the
 * behaviour that actually stops an invoice being forgotten.
 *
 * It says as little as it can. On a project part-way through with nothing
 * billable yet it used to sit there reading "Billing / Billed on completion /
 * Nothing on the quote said otherwise", which is a card, a heading and two
 * lines to tell someone the default happened. It renders nothing in that state
 * now.
 *
 * "Billed per milestone" survives, because that one changes what the numbers
 * mean: it is why a £2,800 project is offering to invoice £700. "Billed on
 * completion" does not survive, because it is what everybody assumes anyway.
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
  const perMilestone = project.billing === "PER_MILESTONE";
  // Nothing to bill, nothing unusual about how it bills, and no hint worth
  // giving. An empty card is worse than no card.
  const worthShowing = ready || perMilestone || entry.notReady !== "nothing-done";

  async function invoice() {
    const created = await run(() => invoiceProjectAction(project.id), { skipRefresh: true });
    if (created) router.push(`/invoices/${created.invoiceId}`);
  }

  if (!worthShowing) return null;

  return (
    <Card className={ready ? "border-violet border-[1.5px]" : undefined}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <SubLabel>
            {t.invoices.billing}
          </SubLabel>
          {perMilestone && (
            <div className="font-body font-semibold text-body text-ink mt-1">
              {t.invoices.perMilestone}
            </div>
          )}
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
