"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FreelyLogo } from "@/components/freely-logo";

const ITEMS = [
  { key: "quote", label: "Quote", glyph: "Q", href: "/quote" },
  { key: "track", label: "Track", glyph: "T", href: "/track" },
  { key: "diary", label: "Diary", glyph: "D", href: "/diary" },
  { key: "invoices", label: "Invoice", glyph: "I", href: "/invoices" },
  { key: "memory", label: "Memory", glyph: "M", href: "/memory" },
];

/**
 * Navigation. A vertical rail on desktop, a fixed bottom bar on mobile.
 *
 * Bottom bar rather than a hamburger: there are only five destinations, they
 * all matter, and on a phone the bottom of the screen is the easiest place to
 * reach. The logo is dropped on mobile, where vertical space is the scarce
 * thing and a home link would just be a sixth tap target competing with the
 * five that do the work.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-40 flex flex-row items-stretch justify-around
        bg-white border-t border-line
        md:static md:z-auto md:w-[104px] md:flex-col md:items-center md:justify-start
        md:border-t-0 md:border-r md:py-7 md:gap-11 md:flex-shrink-0 md:h-screen md:sticky md:top-0
      "
    >
      <Link href="/quote" aria-label="Home" className="hidden md:block">
        <FreelyLogo size="sm" />
      </Link>
      <div className="flex flex-row w-full justify-around md:w-auto md:flex-col md:gap-[26px] md:items-center">
        {ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              // Roomy tap target on mobile: the whole cell is tappable rather
              // than just the 34px glyph.
              className="flex flex-col items-center gap-1 md:gap-1.5 flex-1 md:flex-none py-2.5 md:py-0"
            >
              <div
                className={`w-[34px] h-[34px] rounded-[10px] flex items-center justify-center ${
                  active ? "bg-violet-tint" : "border border-line"
                }`}
              >
                <span
                  className={`font-body font-bold text-small ${
                    active ? "text-violet" : "text-text-muted"
                  }`}
                >
                  {item.glyph}
                </span>
              </div>
              <span
                className={`font-body text-caption ${
                  active ? "font-bold text-violet" : "font-medium text-text-muted"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
