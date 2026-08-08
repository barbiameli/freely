import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { invoiceDb } from "@/lib/invoice-db";
import { currencySymbol } from "@/lib/currencies";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NewInvoiceButton } from "./new-invoice-button";

export default async function InvoicesPage() {
  const user = await requireFullUser();

  const [invoices, projects] = await Promise.all([
    invoiceDb.findMany({ where: { userId: user.id }, orderBy: { number: "desc" } }),
    prisma.project.findMany({
      where: teamScopeWhere(user),
      select: { id: true, title: true, client: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <Topbar eyebrow="Invoices" />
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-display italic text-4xl text-coral m-0">Invoices</h1>
          <p className="text-slate text-[15px] mt-2">
            Built from a tracked project, in the same branding as its quote. Your payment details
            are typed in at download and never saved.
          </p>
        </div>
        <NewInvoiceButton projects={projects} />
      </div>

      {invoices.length === 0 ? (
        <Card>
          <div className="text-slate text-[13.5px]">
            No invoices yet. Start one from a tracked project, or from scratch.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {invoices.map((inv) => {
            const total = inv.lineItems.reduce((sum, i) => sum + i.amount, 0) * (1 + inv.taxRate / 100);
            const overdue = !inv.paid && inv.dueAt.getTime() < Date.now();
            return (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="no-underline">
                <Card className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-body font-bold text-[15px] text-ink">
                        #{String(inv.number).padStart(4, "0")}
                      </span>
                      <span className="text-[13.5px] text-slate">
                        {inv.clientName || "No client yet"}
                      </span>
                    </div>
                    <div className="text-[12px] text-text-muted mt-1">
                      Issued {inv.issuedAt.toLocaleDateString("en-GB")} · due{" "}
                      {inv.dueAt.toLocaleDateString("en-GB")}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-body font-bold text-[15px] text-ink">
                      {currencySymbol(inv.currency)}
                      {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span
                      className={`font-body font-semibold text-[10px] uppercase tracking-wide rounded-full px-2.5 py-1 ${
                        inv.paid
                          ? "text-success bg-mint-solid"
                          : overdue
                          ? "text-overdue bg-coral-tint"
                          : "text-slate bg-paper border border-line"
                      }`}
                    >
                      {inv.paid ? "Paid" : overdue ? "Overdue" : "Unpaid"}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Card>
        <Label>Why you retype payment details</Label>
        <p className="text-[12.5px] text-slate mt-1 mb-0">
          Freely never stores your bank details. They go straight into the PDF you download and are
          not written to your account, so a breach here exposes no payment information. The
          trade-off is retyping them, or ticking &quot;remember on this device&quot; on the invoice
          itself, which keeps them in this browser only.
        </p>
      </Card>
    </>
  );
}
