"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/context";

/**
 * The invoice as it will actually arrive, while it is being typed.
 *
 * The real PDF, rendered by the same code that builds the file somebody
 * downloads, shown in an iframe. Not an HTML approximation of it: two
 * templates agree until the day one is edited, and a preview that lies about
 * the document a client receives is worse than no preview.
 *
 * Rendered on the server and fetched, rather than built in the browser. The
 * mapping from a form to a document already exists there, and a second copy of
 * it on the client is the same two-things-describing-one-fact problem wearing
 * different clothes.
 *
 * Debounced, because every keystroke is a render. 700ms is long enough that
 * typing a sentence costs one request and short enough that pausing feels
 * like it responded.
 */
export function LivePreview({
  invoiceId,
  draft,
  paymentBlock,
  paymentNote,
}: {
  invoiceId: string;
  /** The form as it stands. Anything absent falls back to the saved row. */
  draft: Record<string, unknown>;
  paymentBlock: string;
  paymentNote: string;
}) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const previous = useRef<string | null>(null);

  const payload = JSON.stringify({ draft, paymentBlock, paymentNote, preview: true });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        if (!res.ok) throw new Error("preview failed");
        const blob = await res.blob();
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        // Released only once the new one is in hand, so the pane never blinks
        // white between edits.
        if (previous.current) URL.revokeObjectURL(previous.current);
        previous.current = next;
        setUrl(next);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [invoiceId, payload]);

  // Nothing is released on unmount by design: the last object URL is revoked
  // when the next one replaces it, and the browser frees the rest with the
  // page. Revoking here would race the iframe still holding it.

  return (
    <div className="rounded-2xl border border-line bg-white overflow-hidden">
      {url ? (
        <iframe
          src={`${url}#toolbar=0&navpanes=0`}
          title={t.invoices.preview}
          className="w-full h-[70vh] border-none block"
        />
      ) : (
        <div className="h-[70vh] flex items-center justify-center">
          <p className="text-caption text-text-muted m-0">
            {failed ? t.invoices.previewFailed : t.invoices.previewBuilding}
          </p>
        </div>
      )}
    </div>
  );
}
