"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { NotificationBell } from "@/components/notification-bell";
import { useT } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Settings, Users, LogOut, BarChart3 } from "lucide-react";

function initialsFor(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

/**
 * The account controls, and nothing else.
 *
 * It used to carry an eyebrow on the left: "Memory", "Track - Projects",
 * "Quote - Step 1 of 2". Every one of them repeated the item already
 * highlighted in the nav two inches to the left, and sat directly above a
 * heading that said the same thing a third time. On the quotes list it was
 * actively wrong, announcing "Step 1 of 2" over a list of finished quotes.
 *
 * Three names for one screen is two too many, so the row is now what it was
 * always really for: who you are signed in as, and the language.
 */
export function Topbar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const name = session?.user?.name;
  const email = session?.user?.email;

  return (
    <div className="flex justify-end items-center w-full">
      <div className="flex items-center gap-3">
      <span className="md:hidden">
        <LanguageSwitcher compact />
      </span>
      <NotificationBell />
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-[34px] h-[34px] rounded-full bg-violet flex items-center justify-center border-none cursor-pointer"
        >
          <span className="font-body font-bold text-caption text-white">
            {initialsFor(name, email)}
          </span>
        </button>
        {open && (
          <div className="absolute right-0 top-[42px] w-[220px] bg-white border border-line rounded-lg shadow-panel py-1.5 z-50">
            <div className="px-3.5 py-2.5 border-b border-line">
              <div className="font-body font-bold text-small text-ink truncate">
                {name || t.nav.account}
              </div>
              <div className="text-xs text-text-muted truncate">{email}</div>
            </div>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-small text-ink hover:bg-paper"
            >
              <Settings size={14} className="text-slate" />
              {t.nav.account}
            </Link>
            <Link
              href="/team"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-small text-ink hover:bg-paper"
            >
              <Users size={14} className="text-slate" />
              {t.nav.team}
            </Link>
            {/* Only for whoever ADMIN_EMAIL names. Without this the page could
                only be reached by typing the address, which is a page nobody
                opens. Not in the sidebar: it is not part of anybody's work. */}
            {(session?.user as { isAdmin?: boolean } | undefined)?.isAdmin && (
              <Link
                href="/insights"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-small text-ink hover:bg-paper"
              >
                <BarChart3 size={14} className="text-slate" />
                {t.nav.insights}
              </Link>
            )}

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-small text-overdue hover:bg-paper w-full text-left bg-none border-none cursor-pointer border-t border-line mt-1"
            >
              <LogOut size={14} />
              {t.nav.signOut}
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
