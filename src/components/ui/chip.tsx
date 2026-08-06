"use client";

import { ReactNode } from "react";
import clsx from "@/lib/clsx";

export function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "font-body font-medium text-xs px-3.5 py-2 rounded-full",
        onClick ? "cursor-pointer" : "cursor-default",
        active ? "bg-violet text-white border-none" : "bg-paper text-slate border border-line"
      )}
    >
      {children}
    </button>
  );
}
