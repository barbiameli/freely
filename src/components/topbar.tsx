"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Settings, Users, LogOut } from "lucide-react";

function initialsFor(name?: string | null, email?: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

export function Topbar({ eyebrow }: { eyebrow: string }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
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
    <div className="flex justify-between items-center w-full">
      <span className="font-label text-sm text-slate uppercase tracking-wide">{eyebrow}</span>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-[34px] h-[34px] rounded-full bg-violet flex items-center justify-center border-none cursor-pointer"
        >
          <span className="font-body font-bold text-[11px] text-white">
            {initialsFor(name, email)}
          </span>
        </button>
        {open && (
          <div className="absolute right-0 top-[42px] w-[220px] bg-white border border-line rounded-lg shadow-panel py-1.5 z-50">
            <div className="px-3.5 py-2.5 border-b border-line">
              <div className="font-body font-bold text-[13px] text-ink truncate">
                {name || "Your account"}
              </div>
              <div className="text-xs text-text-muted truncate">{email}</div>
            </div>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-ink hover:bg-paper"
            >
              <Settings size={14} className="text-slate" />
              Account settings
            </Link>
            <Link
              href="/team"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-ink hover:bg-paper"
            >
              <Users size={14} className="text-slate" />
              Team
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-overdue hover:bg-paper w-full text-left bg-none border-none cursor-pointer border-t border-line mt-1"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
