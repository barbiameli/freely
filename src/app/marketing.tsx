import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";
import { FreelyLogo } from "@/components/freely-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LocaleProvider } from "@/lib/i18n/context";
import { Reveal } from "./reveal";
import { fill, type Dictionary, type Locale } from "@/lib/i18n";
import {
  ProductPreview,
  QuotePreview,
  TrackPreview,
  ReportPreview,
  InvoicePreview,
} from "./product-preview";

/**
 * The public marketing page, shown at "/" to signed-out visitors only
 * (signed-in users are redirected straight to /quote, see page.tsx).
 *
 * Organised by what the product does rather than how it does it: quoting,
 * tracking, client reporting, invoicing, one section each with a picture of
 * that part of the app. It previously spent a section explaining the AI in four
 * points and another walking through the setup steps, which is mechanism, and
 * mechanism is not what someone deciding whether to sign up is asking about.
 * The AI is one line now, next to the sign-up button, where the question it
 * answers ("does this send things to my clients on its own?") actually occurs.
 *
 * Every claim matches something that exists in the app today. No invented
 * testimonials, no user counts, no "coming soon" described as if it works.
 *
 * This renders on the server, so its strings arrive as a prop rather than
 * through useT(): that hook reads a client context, and the provider is
 * mounted in the (app) layout, which this page sits outside of. The provider is
 * mounted here too, but only so the switcher in the header knows which
 * language is showing.
 */
export function Marketing({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <LocaleProvider locale={locale}>
      <div className="bg-paper">
        <Header t={t} />
        <Hero t={t} />
        <Capabilities t={t} />
        <ClosingCTA t={t} />
        <Footer t={t} />
      </div>
    </LocaleProvider>
  );
}

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
 * Nothing wraps now. The row is allowed to be tight rather than allowed to
 * break.
 */
function Header({ t }: { t: Dictionary }) {
  return (
    <header className="max-w-5xl mx-auto flex items-center justify-between gap-3 px-5 sm:px-6 py-5 sm:py-6">
      <Link href="/" aria-label={t.marketing.home} className="shrink-0">
        <FreelyLogo size="sm" />
      </Link>
      <nav className="flex items-center gap-3 sm:gap-4 shrink-0">
        <LanguageSwitcher compact />
        <Link href="/signin" className="hidden sm:inline font-body font-semibold text-sm text-slate">
          {t.marketing.logIn}
        </Link>
        <Link
          href="/signup"
          className="font-body font-bold text-sm text-white bg-violet px-3.5 sm:px-4 py-2.5 rounded-lg whitespace-nowrap"
        >
          <span className="sm:hidden">{t.marketing.signUp}</span>
          <span className="hidden sm:inline">{t.marketing.signUpFree}</span>
        </Link>
      </nav>
    </header>
  );
}

function Hero({ t }: { t: Dictionary }) {
  return (
    <section className="max-w-4xl mx-auto text-center px-5 sm:px-6 pt-8 sm:pt-10 pb-12 sm:pb-16">
      <h1 className="font-display italic text-[32px] sm:text-[44px] leading-[1.15] sm:leading-[1.1] text-ink m-0">
        {t.marketing.heroTitle} <span className="text-coral">{t.marketing.heroTitleAccent}</span>
      </h1>
      <p className="text-slate text-lead mt-6 max-w-lg mx-auto">{t.marketing.heroBody}</p>
      <div className="mt-10">
        <ProductPreview t={t} />
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-8">
        <Link
          href="/signup"
          className="font-body font-bold text-sm text-white bg-violet px-6 py-3.5 rounded-lg text-center"
        >
          {t.marketing.getStarted}
        </Link>
        <Link
          href="/signin"
          className="font-body font-bold text-sm text-violet bg-white border border-violet px-6 py-3.5 rounded-lg text-center"
        >
          {t.marketing.logIn}
        </Link>
      </div>
    </section>
  );
}

/**
 * The four things it does, each beside a picture of itself.
 *
 * Alternating sides rather than a grid of equal cards: four capabilities in a
 * row reads as a feature list to be skimmed, where one at a time with its own
 * image gets each of them actually looked at.
 */
function Capabilities({ t }: { t: Dictionary }) {
  const sections = [
    {
      title: t.marketing.capQuoteTitle,
      body: t.marketing.capQuoteBody,
      visual: <QuotePreview t={t} />,
    },
    {
      title: t.marketing.capTrackTitle,
      body: t.marketing.capTrackBody,
      visual: <TrackPreview t={t} />,
    },
    {
      title: t.marketing.capReportTitle,
      body: t.marketing.capReportBody,
      visual: <ReportPreview t={t} />,
    },
    {
      title: t.marketing.capInvoiceTitle,
      body: t.marketing.capInvoiceBody,
      visual: <InvoicePreview t={t} />,
    },
  ];

  return (
    <div className="border-t border-line">
      {sections.map((section, i) => (
        <section
          key={section.title}
          className="max-w-5xl mx-auto px-5 sm:px-6 py-12 sm:py-16 border-b border-line last:border-b-0"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            <Reveal className={i % 2 === 1 ? "lg:order-2" : undefined}>
              <h2 className="font-display italic text-[26px] sm:text-3xl text-ink m-0">
                {section.title}
              </h2>
              <p className="text-slate text-body leading-relaxed mt-3 max-w-md">{section.body}</p>
            </Reveal>
            {/* The picture a beat behind the words, so the eye reads the claim
                and then arrives at the evidence. */}
            <Reveal delay={120} className={i % 2 === 1 ? "lg:order-1" : undefined}>
              {section.visual}
            </Reveal>
          </div>
        </section>
      ))}
    </div>
  );
}

function ClosingCTA({ t }: { t: Dictionary }) {
  return (
    <section className="max-w-2xl mx-auto text-center px-5 sm:px-6 py-12 sm:py-16">
      <h2 className="font-display italic text-3xl text-ink m-0">{t.marketing.tryIt}</h2>

      {/* The AI, in one line, here rather than in a section of its own: this is
          where someone decides to hand their client documents to it. */}
      <p className="flex items-start justify-center gap-2 text-slate text-small mt-4 max-w-sm mx-auto text-left sm:text-center">
        <Sparkles size={14} className="text-violet shrink-0 mt-0.5" />
        <span>{t.marketing.aiNote}</span>
      </p>

      <Link
        href="/signup"
        className="inline-block font-body font-bold text-sm text-white bg-violet px-6 py-3.5 rounded-lg mt-6"
      >
        {t.marketing.getStarted}
      </Link>
      <div className="flex items-center justify-center gap-2 text-text-muted text-meta mt-4">
        <ShieldCheck size={14} /> {t.marketing.freeToStart}
      </div>
    </section>
  );
}

function Footer({ t }: { t: Dictionary }) {
  return (
    <footer className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 sm:px-6 py-8 border-t border-line">
      <div className="flex items-center gap-2 text-text-muted text-xs">
        <FreelyLogo size="sm" />
        <span>{fill(t.marketing.copyright, { year: new Date().getFullYear() })}</span>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/signin" className="font-body font-semibold text-xs text-slate">
          {t.marketing.logIn}
        </Link>
        <Link href="/signup" className="font-body font-semibold text-xs text-violet">
          {t.marketing.signUp}
        </Link>
      </div>
    </footer>
  );
}
