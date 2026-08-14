"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { currencySymbol } from "@/lib/currencies";
import { Tabs } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n/context";
import { InvoiceQueueList, type QueueRow } from "./invoice-queue-list";
import { NewInvoiceButton } from "./new-invoice-button";

export interface InvoiceRowView {
  id: string;
  number: number;
  clientName: string;
  issuedAt: string;
  dueAt: string;
  total: number;
  currency: string;
  paid: boolean;
}

type Tab = "queue" | "invoices";

/**
 * Invoices, in two halves: what has been sent, and what is owed to you and has
 * not been billed yet.
 *
 * The second tab is the one that earns its place. Before it, knowing what was
 * ready to invoice meant remembering which projects had finished, which is
 * exactly the kind of thing that slips for a month and then gets invoiced late.
 *
 * It opens on the queue when there is something in it, since that is the tab
 * with an action on it. Otherwise on the invoice list.
 */
export function InvoicesView({
  invoices,
  queue,
  projects,
}: {
  invoices: InvoiceRowView[];
  queue: QueueRow[];
  projects: { id: string; title: string; client: string }[];
}) {
  const t = useT();
  const readyCount = queue.filter((q) => q.lines.length > 0).length;
  const [tab, setTab] = useState<Tab>(readyCount > 0 ? "queue" : "invoices");

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "queue", label: t.invoices.toInvoice, badge: readyCount },
    { id: "invoices", label: t.invoices.previousInvoices, badge: invoices.length },
  ];

  return (
    <>
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="font-display italic text-[30px] md:text-4xl text-coral m-0">
            {t.invoices.title}
          </h1>
        </div>
        <NewInvoiceButton projects={projects} />
      </div>

      {/* The shared strip. This page had its own copy of the markup, which is
          how the same control came to look slightly different on three pages. */}
      <Tabs items={tabs} value={tab} onChange={setTab} label={t.nav.invoices} />

      {tab === "queue" ? (
        <InvoiceQueueList rows={queue} />
      ) : invoices.length === 0 ? (
        <Card>
          <div className="text-slate text-body">{t.invoices.noInvoices}</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {invoices.map((inv) => {
            const overdue = !inv.paid && new Date(inv.dueAt).getTime() < Date.now();
            return (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="no-underline">
                <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-body font-bold text-lead text-ink">
                        #{String(inv.number).padStart(4, "0")}
                      </span>
                      <span className="text-body text-slate">{inv.clientName}</span>
                    </div>
                    <div className="text-meta text-text-muted mt-1">
                      {new Date(inv.issuedAt).toLocaleDateString("en-GB")} ·{" "}
                      {new Date(inv.dueAt).toLocaleDateString("en-GB")}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-body font-bold text-lead text-ink tabular-nums">
                      {currencySymbol(inv.currency)}
                      {inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span
                      className={`font-body font-semibold text-caption uppercase tracking-wide rounded-full px-2.5 py-1 ${
                        inv.paid
                          ? "text-success bg-mint-solid"
                          : overdue
                          ? "text-overdue bg-coral-tint"
                          : "text-slate bg-paper border border-line"
                      }`}
                    >
                      {inv.paid ? t.invoices.paidShort : overdue ? t.invoices.overdue : t.invoices.unpaid}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

    </>
  );
}
