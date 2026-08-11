import Link from "next/link";
import { ShieldCheck, Sparkles } from "lucide-react";
import { FreelyLogo } from "@/components/freely-logo";
import { LocaleProvider } from "@/lib/i18n/context";
import { MarketingHeader } from "./marketing-header";
import { Reveal, Rise } from "./reveal";
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
 * The motion is deliberate about one thing: it follows the reading order.
 * The hero arrives in the order you read it, each section's words land before
 * its picture, and the pictures assemble themselves as you reach them, so what
 * moves is always what you were about to look at. Motion that runs ahead of the
 * reader is decoration. See reveal.tsx for the mechanics, all of which stop for
 * anyone who has asked their system for less movement.
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
        <MarketingHeader t={t} />
        <Hero t={t} />
        <Capabilities t={t} />
        <ClosingCTA t={t} />
        <Footer t={t} />
      </div>
    </LocaleProvider>
  );
}

/**
 * Two faint clouds behind the hero.
 *
 * Coral and violet, the two brand colours, at an opacity where you would not
 * point at them but the page stops looking like white paper. Absolutely
 * positioned and pointer-events-none so it cannot interfere with anything, and
 * clipped by the section so it never bleeds into the capabilities below.
 */
function HeroGlow() {
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute -top-24 -left-16 w-[520px] h-[520px] rounded-full bg-coral/[0.10] blur-3xl animate-drift-a" />
      <div className="absolute -top-32 right-0 w-[460px] h-[460px] rounded-full bg-violet/[0.09] blur-3xl animate-drift-b" />
    </div>
  );
}

/**
 * The hero, arriving in the order it is read.
 *
 * Headline, then the line under it, then the picture of the app, then the
 * buttons: 80ms apart, which is enough to be a sequence and not enough to be a
 * wait. The whole entrance is over in under a second.
 *
 * The picture comes before the buttons deliberately. It is the evidence for the
 * claim above it, and the buttons are what you do once you believe the claim.
 */
function Hero({ t }: { t: Dictionary }) {
  return (
    <section className="relative max-w-4xl mx-auto text-center px-5 sm:px-6 pt-8 sm:pt-10 pb-12 sm:pb-16">
      <HeroGlow />

      <Rise>
        <h1 className="font-display italic text-[32px] sm:text-[44px] leading-[1.15] sm:leading-[1.1] text-ink m-0">
          {t.marketing.heroTitle} <span className="text-coral">{t.marketing.heroTitleAccent}</span>
        </h1>
      </Rise>

      <Rise delay={80}>
        <p className="text-slate text-lead mt-6 max-w-lg mx-auto">{t.marketing.heroBody}</p>
      </Rise>

      <Rise delay={160} className="mt-10">
        {/* One sweep of light across the app as it lands, then never again. It
            sits over the preview rather than on the headline: a gradient clipped
            to text needs the text itself to be transparent, which would mean
            betting the hero headline on a background-clip working. */}
        <div className="relative">
          <ProductPreview t={t} />
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-card pointer-events-none animate-sheen"
          />
        </div>
      </Rise>

      <Rise delay={240}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-8">
          <Link
            href="/signup"
            className="font-body font-bold text-sm text-white bg-violet px-6 py-3.5 rounded-lg text-center transition-[transform,box-shadow] duration-300 ease-marketing hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {t.marketing.getStarted}
          </Link>
          <Link
            href="/signin"
            className="font-body font-bold text-sm text-violet bg-white border border-violet px-6 py-3.5 rounded-lg text-center transition-[transform,background-color] duration-300 ease-marketing hover:-translate-y-0.5 hover:bg-violet-tint active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {t.marketing.logIn}
          </Link>
        </div>
      </Rise>
    </section>
  );
}

/**
 * The four things it does, each beside a picture of itself.
 *
 * Alternating sides rather than a grid of equal cards: four capabilities in a
 * row reads as a feature list to be skimmed, where one at a time with its own
 * image gets each of them actually looked at.
 *
 * The words come in from the outside edge they sit on, so a section reads as
 * opening outwards from the middle of the page instead of everything drifting
 * upwards in the same direction four times. The picture grows in rather than
 * sliding, because it is the thing you end up looking at, and something that
 * comes forward holds attention where something passing through does not.
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
      {sections.map((section, i) => {
        const flipped = i % 2 === 1;
        return (
          <section
            key={section.title}
            className="max-w-5xl mx-auto px-5 sm:px-6 py-12 sm:py-16 border-b border-line last:border-b-0"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
              <Reveal
                from={flipped ? "right" : "left"}
                className={flipped ? "lg:order-2" : undefined}
              >
                <h2 className="font-display italic text-[26px] sm:text-3xl text-ink m-0">
                  {section.title}
                </h2>
                <p className="text-slate text-body leading-relaxed mt-3 max-w-md">{section.body}</p>
              </Reveal>
              {/* The picture a beat behind the words, so the eye reads the claim
                  and then arrives at the evidence. */}
              <Reveal
                from="scale"
                delay={140}
                className={flipped ? "lg:order-1" : undefined}
              >
                {section.visual}
              </Reveal>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ClosingCTA({ t }: { t: Dictionary }) {
  return (
    <section className="max-w-2xl mx-auto text-center px-5 sm:px-6 py-12 sm:py-16">
      <Reveal>
        <h2 className="font-display italic text-3xl text-ink m-0">{t.marketing.tryIt}</h2>

        {/* The AI, in one line, here rather than in a section of its own: this is
            where someone decides to hand their client documents to it. */}
        <p className="flex items-start justify-center gap-2 text-slate text-small mt-4 max-w-sm mx-auto text-left sm:text-center">
          <Sparkles size={14} className="text-violet shrink-0 mt-0.5" />
          <span>{t.marketing.aiNote}</span>
        </p>

        <Link
          href="/signup"
          className="inline-block font-body font-bold text-sm text-white bg-violet px-6 py-3.5 rounded-lg mt-6 transition-[transform,box-shadow] duration-300 ease-marketing hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          {t.marketing.getStarted}
        </Link>
        <div className="flex items-center justify-center gap-2 text-text-muted text-meta mt-4">
          <ShieldCheck size={14} /> {t.marketing.freeToStart}
        </div>
      </Reveal>
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
        <Link
          href="/signin"
          className="font-body font-semibold text-xs text-slate transition-colors duration-200 hover:text-ink"
        >
          {t.marketing.logIn}
        </Link>
        <Link
          href="/signup"
          className="font-body font-semibold text-xs text-violet transition-colors duration-200 hover:text-coral"
        >
          {t.marketing.signUp}
        </Link>
      </div>
    </footer>
  );
}
