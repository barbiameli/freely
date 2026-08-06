"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { key: "quote", label: "Quote", glyph: "Q", href: "/quote" },
  { key: "track", label: "Track", glyph: "T", href: "/track" },
  { key: "diary", label: "Diary", glyph: "D", href: "/diary" },
  { key: "memory", label: "Memory", glyph: "M", href: "/memory" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-[104px] bg-white border-r border-line flex flex-col items-center py-7 gap-11 flex-shrink-0 h-screen sticky top-0">
      <span className="font-display italic text-[22px] text-coral">Freely</span>
      <div className="flex flex-col gap-[26px] items-center">
        {ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center ${
                  active ? "bg-violet-tint" : "border border-line"
                }`}
              >
                <span
                  className={`font-body font-bold text-[13px] ${
                    active ? "text-violet" : "text-text-muted"
                  }`}
                >
                  {item.glyph}
                </span>
              </div>
              <span
                className={`font-body text-[10.5px] ${
                  active ? "font-bold text-violet" : "font-medium text-text-muted"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
