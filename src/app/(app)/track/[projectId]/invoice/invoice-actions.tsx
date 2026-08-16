"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCheckoutSessionAction } from "@/actions/invoice";
import { useT } from "@/lib/i18n/context";

export function InvoiceActions({
  projectId,
  invoiceStatus,
  existingCheckoutUrl,
  stripeConfigured,
}: {
  projectId: string;
  invoiceStatus: "UNPAID" | "PENDING" | "PAID";
  existingCheckoutUrl: string | null;
  stripeConfigured: boolean;
}) {
  const t = useT();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState(existingCheckoutUrl);

  // Online payment is not switched on, so there is no button to explain. The
  // invoice PDF is the whole feature here and it works on its own; a disabled
  // button with a note under it would be the app advertising something the
  // person cannot have and blaming a setting they have never heard of.
  if (!stripeConfigured) return null;

  if (invoiceStatus === "PAID") {
    return <div className="text-success font-body font-semibold text-sm">{t.invoices.paidNothingElse}</div>;
  }

  async function handleSend() {
    setWorking(true);
    setError("");
    const result = await createCheckoutSessionAction(projectId);
    setWorking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCheckoutUrl(result.data.url);
    window.location.href = result.data.url;
  }

  return (
    <div className="flex flex-col gap-2">
      <Button icon={CreditCard} disabled={working} onClick={handleSend} className="justify-center">
        {working
          ? t.invoices.creatingCheckout
          : checkoutUrl
            ? t.invoices.resendForPayment
            : t.invoices.sendForPayment}
      </Button>
      {checkoutUrl && (
        <a href={checkoutUrl} target="_blank" rel="noreferrer" className="text-xs text-violet font-semibold">
          {t.invoices.openPaymentLink}
        </a>
      )}
      {error && <div className="text-overdue text-xs">{error}</div>}
    </div>
  );
}
