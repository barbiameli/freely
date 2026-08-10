"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import { useT } from "@/lib/i18n/context";

/**
 * Downloads a generated PDF, with something to watch while it builds.
 *
 * It used to be a plain anchor with a download attribute. Rendering a quote
 * server-side takes a few seconds, during which the click did nothing
 * visible, so the natural response was to click again and start a second
 * render. A failure was worse: the browser either downloaded an error page or
 * did nothing at all.
 */
export function DownloadPdfButton({
  href,
  fileName,
  label,
}: {
  href: string;
  fileName: string;
  label?: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(href);
      if (!res.ok) {
        setError(t.brief.pdfFailed);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t.common.noConnection);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="outline" icon={Download} spinIcon={busy} disabled={busy} onClick={download}>
        {busy ? t.brief.buildingPdf : label ?? t.brief.downloadPdf}
      </Button>
      <ActionError error={error} />
    </div>
  );
}
