"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { setSectionAction } from "@/actions/portal";
import { useT } from "@/lib/i18n/context";

/**
 * One section of the client's page: whether it is shown, and what is in it.
 *
 * The switch and the contents in the same row, because they are the same
 * decision made twice. A settings screen that lists what is on, somewhere
 * apart from the thing it is on for, is how somebody ends up switching
 * Documents on for a client they never uploaded anything for.
 *
 * Switched off, the contents collapse and stay collapsed: there is nothing to
 * arrange about a section nobody will see, and leaving it open invites work
 * that will not be looked at.
 */
export function SectionToggle({
  clientId,
  section,
  on,
  title,
  hint,
  warning,
  children,
}: {
  clientId: string;
  section: string;
  on: boolean;
  title: string;
  hint: string;
  /** Said louder, for the switch that changes what is safe to write elsewhere. */
  warning?: string;
  children?: ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="border-b border-line last:border-b-0 py-3.5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? t.sections.hide : t.sections.show}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await setSectionAction(clientId, section, !on);
            setBusy(false);
            if (!on) setOpen(true);
            router.refresh();
          }}
          className={`shrink-0 mt-0.5 w-9 h-5 rounded-full relative transition-colors cursor-pointer border-none disabled:opacity-60 ${
            on ? "bg-violet" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              on ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => on && setOpen(!open)}
          aria-expanded={on ? open : undefined}
          disabled={!on || !children}
          className="min-w-0 flex-1 text-left bg-none border-none cursor-pointer disabled:cursor-default p-0 tap-row"
        >
          <span className="block font-body font-semibold text-small text-ink">{title}</span>
          <span
            className={`block text-caption ${
              on && warning ? "text-amber font-semibold" : "text-text-muted"
            }`}
          >
            {on && warning ? warning : hint}
          </span>
        </button>

        {on && children && (
          <ChevronDown
            size={14}
            className={`text-text-muted shrink-0 mt-1 transition-transform ${
              open ? "" : "-rotate-90"
            }`}
            aria-hidden
          />
        )}
      </div>

      {on && open && children && <div className="mt-3.5 pl-12">{children}</div>}
    </div>
  );
}
