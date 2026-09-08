import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { isStripeConfigured } from "@/lib/stripe";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { currencySymbol } from "@/lib/currencies";
import { InvoiceActions } from "./invoice-actions";
import { RaiseInvoice } from "./raise-invoice";
import { serverDict } from "@/lib/i18n/server";

export default async function InvoicePage({ params }: { params: { projectId: string } }) {
  const t = await serverDict();
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, ...teamScopeWhere(user) },
    include: { deliverables: true },
  });
  if (!project) notFound();

  // Whether this project already has an invoice, so the button opens it
  // rather than raising a second one.
  const existing = await prisma.invoice.findFirst({
    where: { projectId: project.id, ...teamScopeWhere(user) },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const rate = project.hours > 0 ? project.price / project.hours : 0;
  const doneCount = project.deliverables.filter((d) => d.done).length;

  return (
    <>
      <div>
        <h1 className="font-display italic text-[30px] text-coral m-0">{t.invoices.summary}</h1>
        <p className="text-slate text-small mt-1.5">
          {isStripeConfigured() ? t.invoices.payOnlineIntro : t.invoices.pdfOnlyIntro}{" "}
          <Link href={`/track/${project.id}`} className="text-violet font-semibold">
            {t.invoices.backToProject}
          </Link>
        </p>
      </div>
      <Card className="max-w-xl">
        <div className="flex justify-between items-baseline pb-4 border-b border-line">
          <div>
            <div className="font-body font-bold text-lg text-ink">{project.title}</div>
            <div className="text-slate text-small">{project.client}</div>
          </div>
          <div className="text-xs text-text-muted">
            {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
        </div>
        <div className="flex flex-col gap-3 py-4 border-b border-line">
          <Row
            label={t.invoices.deliverablesCompleted}
            value={`${doneCount} / ${project.deliverables.length}`}
          />
          <Row
            label={t.invoices.hoursLogged}
            value={`${project.hoursLogged} / ${project.hours}`}
          />
          <Row
            label={t.invoices.effectiveRate}
            value={rate > 0 ? `${currencySymbol(project.currency)}${rate.toFixed(0)} / hr` : "-"}
          />
          <Row label={t.invoices.paymentStatus} value={project.invoiceStatus} />
          {/* Its own block rather than a row. A timeline is a paragraph, and
              in a label-left value-right row it collapsed against its own
              label and rendered as "TimelineAround 2 to 3 hours on the site". */}
          {project.timeline && (
            <div className="pt-1">
              <div className="text-slate text-body">{t.publicQuote.timeline}</div>
              <p className="text-ink text-body m-0 mt-1 text-pretty">{project.timeline}</p>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center pt-4">
          <Label>{t.publicQuote.total}</Label>
          <span className="font-body font-bold text-2xl text-link">
            {currencySymbol(project.currency)}
            {project.price.toLocaleString()}
          </span>
        </div>
        <div className="pt-5 flex flex-col gap-3">
          <RaiseInvoice projectId={project.id} existingInvoiceId={existing?.id ?? null} />
          <InvoiceActions
            projectId={project.id}
            invoiceStatus={project.invoiceStatus}
            existingCheckoutUrl={project.stripeCheckoutUrl}
            stripeConfigured={isStripeConfigured()}
          />
        </div>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-body">
      <span className="text-slate">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}
