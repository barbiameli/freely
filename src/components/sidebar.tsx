"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderKanban, House, Receipt, Sparkles } from "lucide-react";
import { FreelyLogo } from "@/components/freely-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Topbar } from "@/components/topbar";
import { useT } from "@/lib/i18n/context";

const ITEMS = [
  // Home first, because signing in lands here now. The rail used to open on
  // the quote form, which assumes somebody came to write a new quote rather
  // than to find out where the last one got to.
  // Icons rather than initials. "H", "Q", "T", "I", "M" only work if you
  // already know what they stand for, which is a thing you learn once and
  // then never think about, and until you have learned it the rail is five
  // letters. A house is a house in any language, which also matters here:
  // the labels are translated and the initials were not, so the Spanish rail
  // read "H Q T I M" above Inicio, Presupuesto, Seguimiento, Facturas.
  { key: "home", icon: House, href: "/home" },
  { key: "quote", icon: FileText, href: "/quote" },
  { key: "track", icon: FolderKanban, href: "/track" },
  { key: "invoices", icon: Receipt, href: "/invoices" },
  // Fifth and last. The rail is full at five, and anything after this belongs
  // inside one of these rather than beside them. The ground rules were briefly
  // a sixth item and are now a tab in here, which is where the rest of what
  // Freely knows about how you work already was.
  { key: "memory", icon: Sparkles, href: "/memory" },
] as const;

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
  const t = useT();

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-40 flex flex-row items-stretch justify-around
        bg-white border-t border-line safe-bottom
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
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              // Roomy tap target on mobile: the whole cell is tappable rather
              // than just the 34px glyph.
              className="group flex flex-col items-center gap-1 md:gap-1.5 flex-1 md:flex-none py-2.5 md:py-0"
            >
              {/* No box. A rounded outline around every icon drew five
                  containers down the rail and made the icons the small thing
                  inside them; the icon is the thing, so it gets the space.
                  The active one keeps its tint, which was the only job the
                  container was still doing. */}
              <div
                className={`w-[38px] h-[38px] rounded-[11px] flex items-center justify-center transition-colors ${
                  active ? "bg-violet-tint" : "bg-transparent"
                }`}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2 : 1.6}
                  className={`transition-transform duration-150 ease-marketing motion-reduce:transition-none group-hover:scale-110 ${
                    active ? "text-violet" : "text-text-muted group-hover:text-ink"
                  }`}
                  aria-hidden
                />
              </div>
              <span
                // Wraps rather than overflowing: Spanish nav labels run about
                // half as long again as the English, and five of them share
                // the width of a phone.
                className={`font-body text-caption text-center leading-tight max-w-full ${
                  active ? "font-bold text-violet" : "font-medium text-text-muted"
                }`}
              >
                {t.nav[item.key]}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Desktop only: on mobile the rail is a bottom bar with no room, so the
          switcher rides in the top bar there instead. */}
      {/* Account and notifications live with the navigation rather than in a
          band across the top of every page. */}
      <div className="hidden md:flex md:flex-col md:items-center md:gap-4 md:mt-auto">
        <Topbar />
        <LanguageSwitcher compact />
      </div>
    </nav>
  );
}
