"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import { invoiceProjectAction } from "@/actions/invoices";
import { useT } from "@/lib/i18n/context";

/**
 * The button this page was describing and did not have.
 *
 * It said "Download this as a PDF and send it however you normally invoice"
 * above a card with nothing to press. The PDF route is keyed on an Invoice
 * record, and this page is a summary of a project, so there was no file to
 * download and no way to make one from here: the only route to an invoice was
 * the queue on another screen.
 *
 * Pressing this raises the invoice from the project, the same call the queue
 * makes, and opens it where the numbers can be checked and the PDF is a real
 * button. It goes to the editor rather than downloading straight away on
 * purpose: an invoice is a document somebody sends for money, and the line
 * items and dates are worth seeing before it exists as a file.
 */
export function RaiseInvoice({
  projectId,
  existingInvoiceId,
}: {
  projectId: string;
  /** Where a previous invoice for this project already lives. */
  existingInvoiceId: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function open() {
    if (existingInvoiceId) {
      router.push(`/invoices/${existingInvoiceId}`);
      return;
    }
    setWorking(true);
    setError("");
    const result = await invoiceProjectAction(projectId);
    if (!result.ok) {
      setWorking(false);
      setError(result.error);
      return;
    }
    router.push(`/invoices/${result.data.invoiceId}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button icon={FileText} loading={working} onClick={open} className="justify-center">
        {existingInvoiceId ? t.invoices.openInvoice : t.invoices.raiseInvoice}
      </Button>
      <ActionError error={error} />
    </div>
  );
}
