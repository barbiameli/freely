"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createInvoiceAction } from "@/actions/invoices";

/** Starting from a project pre-fills the client, amount, currency and the
 * quote's branding, which is most of the invoice. Blank is there for anything
 * that never went through Track. */
export function NewInvoiceButton({
  projects,
}: {
  projects: { id: string; title: string; client: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function create(projectId?: string) {
    setError("");
    startTransition(async () => {
      const result = await createInvoiceAction(projectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/invoices/${result.data.invoiceId}`);
    });
  }

  if (!open) {
    return (
      <Button icon={Plus} disabled={pending} onClick={() => setOpen(true)}>
        New invoice
      </Button>
    );
  }

  return (
    <div className="bg-white border border-line rounded-card shadow-panel p-4 w-full md:w-[320px]">
      <div className="text-[11px] font-bold text-slate uppercase tracking-wide mb-2.5">
        Start from
      </div>
      <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            onClick={() => create(p.id)}
            className="text-left bg-paper hover:bg-violet-tint rounded-lg px-3 py-2 border-none cursor-pointer"
          >
            <span className="block font-body font-semibold text-[13px] text-ink">{p.title}</span>
            <span className="block text-[11.5px] text-slate">{p.client}</span>
          </button>
        ))}
        {projects.length === 0 && (
          <span className="text-[12.5px] text-text-muted">No tracked projects yet.</span>
        )}
      </div>
      {error && <div className="text-overdue text-xs mt-2">{error}</div>}
      <div className="flex justify-between items-center mt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => create()}
          className="font-body font-bold text-[12.5px] text-violet bg-none border-none cursor-pointer p-0"
        >
          {pending ? "Creating..." : "Blank invoice"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12.5px] text-text-muted bg-none border-none cursor-pointer p-0"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
