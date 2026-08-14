"use client";

import { useRouter } from "next/navigation";
import { Check, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProjectCard, ProjectCardGrid } from "@/components/project-card";
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
  status: string;
  price: number;
  hours: number;
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
 * Same cards as Track, and clicking one goes there. These are the same
 * projects, so two different shapes for them would be two things to learn, and
 * the question this list raises ("what is left on that?") is answered on the
 * project page.
 *
 * Projects with nothing ready stay visible rather than being hidden: knowing
 * three projects are running and none is billable yet is the same question
 * answered.
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
    <ProjectCardGrid>
      {rows.map((row) => (
        <QueueCard key={row.projectId} row={row} />
      ))}
    </ProjectCardGrid>
  );
}

function QueueCard({ row }: { row: QueueRow }) {
  const t = useT();
  const router = useRouter();
  const { run, pending, error } = useAction();
  const ready = row.lines.length > 0;
  const progress = row.totalCount > 0 ? row.doneCount / row.totalCount : 0;

  async function invoice() {
    const created = await run(() => invoiceProjectAction(row.projectId), { skipRefresh: true });
    if (created.ok) router.push(`/invoices/${created.data.invoiceId}`);
  }

  return (
    <ProjectCard
      href={`/track/${row.projectId}`}
      highlight={ready}
      project={{
        id: row.projectId,
        title: row.title,
        client: row.client,
        status: row.status,
        progress,
        meta: `${currencySymbol(row.currency)}${row.price.toLocaleString()} · ${row.hours}h · ${fill(
          t.invoices.deliverablesDone,
          { done: row.doneCount, total: row.totalCount }
        )}`,
      }}
    >
      {ready ? (
        <>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="text-caption text-text-muted">
              {row.perMilestone ? t.invoices.perMilestone : t.invoices.onCompletion}
            </span>
            <span className="font-body font-bold text-lead text-ink tabular-nums">
              {currencySymbol(row.currency)}
              {row.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <Button icon={FileText} onClick={invoice} disabled={pending} className="w-full justify-center">
            {pending ? t.common.working : t.invoices.invoiceIt}
          </Button>
        </>
      ) : row.notReady === "in-progress" || row.notReady === "nothing-done" ? (
        <Button
          variant="outline"
          icon={Check}
          disabled={pending}
          className="w-full justify-center"
          onClick={() => run(() => markProjectDoneAction(row.projectId))}
        >
          {pending ? t.common.working : t.invoices.markFinished}
        </Button>
      ) : null}

      <ActionError error={error} />
    </ProjectCard>
  );
}
