"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCheckoutSessionAction } from "@/actions/invoice";

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
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState(existingCheckoutUrl);

  if (invoiceStatus === "PAID") {
    return <div className="text-success font-body font-semibold text-sm">Paid, nothing else to do.</div>;
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
      <Button icon={CreditCard} disabled={working || !stripeConfigured} onClick={handleSend} className="justify-center">
        {working ? "Creating checkout..." : checkoutUrl ? "Resend for payment" : "Send for payment"}
      </Button>
      {!stripeConfigured && (
        <div className="text-xs text-text-muted">
          Add STRIPE_SECRET_KEY to .env to enable this.
        </div>
      )}
      {checkoutUrl && (
        <a href={checkoutUrl} target="_blank" rel="noreferrer" className="text-xs text-violet font-semibold">
          Open payment link
        </a>
      )}
      {error && <div className="text-overdue text-xs">{error}</div>}
    </div>
  );
}
