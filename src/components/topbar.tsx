"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function Topbar({ eyebrow, initials = "BM" }: { eyebrow: string; initials?: string }) {
  return (
    <div className="flex justify-between items-center w-full">
      <span className="font-label text-sm text-slate uppercase tracking-wide">{eyebrow}</span>
      <div className="flex items-center gap-4">
        <Link href="/team" className="text-xs text-slate font-body font-semibold">
          Team
        </Link>
        <button
          type="button"
          title="Sign out"
          onClick={() => signOut({ callbackUrl: "/signin" })}
          className="w-[34px] h-[34px] rounded-full bg-violet flex items-center justify-center"
        >
          <span className="font-body font-bold text-[11px] text-white">{initials}</span>
        </button>
      </div>
    </div>
  );
}
