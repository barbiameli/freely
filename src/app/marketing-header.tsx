"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FreelyLogo } from "@/components/freely-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Dictionary } from "@/lib/i18n";

/**
 * Logo left, everything you can do right.
 *
 * The switcher belongs with the other controls rather than beside the logo: the
 * logo is identity, the right side is action, and a language toggle is an
 * action.
 *
 * That is four things on one row, which is what made this wrap on a phone: with
 * flex-wrap it coped by dropping the switcher onto its own line underneath,
 * which read as a bug. Two changes make it fit at 390px instead. The button
 * says "Sign up" below 640px, because "Crear cuenta gratis" is 19 characters
 * and it is the button that runs out of room first in Spanish. And the Log in
 * link is hidden on a phone, where it is the least necessary of the four: the
 * hero underneath has its own Log in button, so nothing is lost.
 *
 * It sticks now, and earns a hairline and a frosted backdrop once you have
 * scrolled past the hero. Both appear rather than being there from the start,
 * because a border under a header sitting on its own page background is a line
 * drawn for no reason: it means "there is content behind me", and at the top
 * there isn't.
 */
export function MarketingHeader({ t }: { t: Dictionary }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Read once on mount too: a reload halfway down a page restores the scroll
    // position without firing an event, which left the header bare over content.
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled
          ? "bg-paper/85 backdrop-blur-md border-b border-line"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 px-5 sm:px-6 py-4 sm:py-5">
        <Link
          href="/"
          aria-label={t.marketing.home}
          className="shrink-0 transition-transform duration-300 ease-marketing hover:scale-[1.03] motion-reduce:transition-none"
        >
          <FreelyLogo size="sm" />
        </Link>
        <nav className="flex items-center gap-3 sm:gap-4 shrink-0">
          <LanguageSwitcher compact />
          <Link
            href="/signin"
            className="hidden sm:inline font-body font-semibold text-sm text-slate transition-colors duration-200 hover:text-ink"
          >
            {t.marketing.logIn}
          </Link>
          <Link
            href="/signup"
            className="font-body font-bold text-sm text-white bg-violet px-3.5 sm:px-4 py-2.5 rounded-lg whitespace-nowrap transition-[transform,box-shadow] duration-300 ease-marketing hover:-translate-y-0.5 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <span className="sm:hidden">{t.marketing.signUp}</span>
            <span className="hidden sm:inline">{t.marketing.signUpFree}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
