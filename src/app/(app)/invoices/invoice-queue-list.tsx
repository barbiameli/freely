"use client";

import { useRouter } from "next/navigation";
import { Check, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import { useAction } from "@/lib/use-action";
import { currencySymbol } from "@/lib/currencies";
import { invoiceProjectAction, markProjectDoneAction } from "@/actions/invoices";
import { useT } from "@/lib/i18n/context";
import { fill } from "@/lib/i18n";
import type { NotReady } from "@/lib/invoice-queue";

export interface QueueRow {
  projectId: string;
  title: string;
  client: string;
  currency: string;
  perMilestone: boolean;
  /** What can be billed right now. */
  lines: { title: string; hours: number; amount: number }[];
  total: number;
  notReady: NotReady | null;
  doneCount: number;
  totalCount: number;
}

/**
 * Work that has been done and not yet billed.
 *
 * The point of this list is that invoicing should not require remembering. A
 * project appears here as soon as there is something to bill, with the amount
 * already worked out, and leaves once it is billed.
 *
 * Projects with nothing ready stay visible rather than being hidden, because
 * knowing three projects are running and none is billable yet is the same
 * question answered.
 */
export function InvoiceQueueList({ rows }: { rows: QueueRow[] }) {
  const t = useT();

  if (rows.length === 0) {
    return (
      <Card>
        <div className="text-slate text-body">{t.invoices.queueEmpty}</div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <QueueCard key={row.projectId} row={row} />
      ))}
    </div>
  );
}

function QueueCard({ row }: { row: QueueRow }) {
  const t = useT();
  const router = useRouter();
  const { run, pending, error } = useAction();
  const ready = row.lines.length > 0;

  async function invoice() {
    // Straight into the new invoice: the point of prefilling it is that the
    // next thing you do is read it, not go looking for it.
    const created = await run(() => invoiceProjectAction(row.projectId), { skipRefresh: true });
    if (created) router.push(`/invoices/${created.invoiceId}`);
  }

  return (
    <Card className={ready ? "border-violet border-[1.5px]" : undefined}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="font-body font-bold text-lead text-ink">{row.title}</div>
          <div className="text-meta text-text-muted mt-0.5">
            {row.client} ·{" "}
            {row.perMilestone ? t.invoices.perMilestone : t.invoices.onCompletion} ·{" "}
            {fill(t.invoices.deliverablesDone, {
              done: row.doneCount,
              total: row.totalCount,
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {ready ? (
            <>
              <span className="font-body font-bold text-lead text-ink tabular-nums">
                {currencySymbol(row.currency)}
                {row.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <Button icon={FileText} onClick={invoice} disabled={pending}>
                {pending ? t.common.working : t.invoices.invoiceIt}
              </Button>
            </>
          ) : row.notReady === "in-progress" || row.notReady === "nothing-done" ? (
            <Button
              variant="outline"
              icon={Check}
              disabled={pending}
              onClick={() => run(() => markProjectDoneAction(row.projectId))}
            >
              {pending ? t.common.working : t.invoices.markFinished}
            </Button>
          ) : null}
        </div>
      </div>

      {/* The lines that will go on the invoice, so it is clear what is being
          billed before anything is created. */}
      {ready && (
        <div className="mt-3 pt-3 border-t border-line flex flex-col gap-1.5">
          {row.lines.map((line) => (
            <div key={line.title} className="flex items-baseline justify-between gap-3">
              <span className="text-small text-slate min-w-0 truncate">{line.title}</span>
              <span className="flex items-baseline gap-3 shrink-0">
                {line.hours > 0 && (
                  <span className="text-caption text-text-muted tabular-nums">{line.hours}h</span>
                )}
                <span className="text-caption text-ink tabular-nums">
                  {currencySymbol(row.currency)}
                  {line.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {!ready && row.notReady === "in-progress" && (
        <p className="text-caption text-text-muted mt-2 mb-0">{t.invoices.finishToInvoice}</p>
      )}

      <ActionError error={error} className="mt-2" />
    </Card>
  );
}
