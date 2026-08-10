import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { isStripeConfigured } from "@/lib/stripe";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { currencySymbol } from "@/lib/currencies";
import { InvoiceActions } from "./invoice-actions";

export default async function InvoicePage({ params }: { params: { projectId: string } }) {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, ...teamScopeWhere(user) },
    include: { deliverables: true },
  });
  if (!project) notFound();

  const rate = project.hours > 0 ? project.price / project.hours : 0;
  const doneCount = project.deliverables.filter((d) => d.done).length;

  return (
    <>
      <Topbar eyebrow={`Track - ${project.title} - Invoice`} />
      <div>
        <h1 className="font-display italic text-[30px] text-coral m-0">Invoice summary</h1>
        <p className="text-slate text-small mt-1.5">
          {isStripeConfigured()
            ? "Send this for real payment via Stripe's hosted checkout, Freely never touches card details."
            : "A computed summary, connect Stripe (STRIPE_SECRET_KEY in .env) to accept real payment."}{" "}
          <Link href={`/track/${project.id}`} className="text-violet font-semibold">
            Back to project
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
          <Row label="Deliverables completed" value={`${doneCount} / ${project.deliverables.length}`} />
          <Row label="Hours logged" value={`${project.hoursLogged} / ${project.hours}`} />
          <Row
            label="Effective rate"
            value={rate > 0 ? `${currencySymbol(project.currency)}${rate.toFixed(0)} / hr` : "-"}
          />
          <Row label="Timeline" value={project.timeline || "-"} />
          <Row label="Payment status" value={project.invoiceStatus} />
        </div>
        <div className="flex justify-between items-center pt-4">
          <Label>Total</Label>
          <span className="font-body font-bold text-2xl text-violet">
            {currencySymbol(project.currency)}
            {project.price.toLocaleString()}
          </span>
        </div>
        <div className="pt-5">
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
