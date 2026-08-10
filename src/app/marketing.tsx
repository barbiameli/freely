import Link from "next/link";
import { FileText, ListChecks, Users, ShieldCheck, Sparkles } from "lucide-react";
import { FreelyLogo } from "@/components/freely-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LocaleProvider } from "@/lib/i18n/context";
import { fill, type Dictionary, type Locale } from "@/lib/i18n";

/**
 * The public marketing page, shown at "/" to signed-out visitors only
 * (signed-in users are redirected straight to /quote, see page.tsx). Kept
 * deliberately simple and honest: every claim here matches something that
 * actually exists in the app today. No fabricated testimonials, no made-up
 * user counts, no "coming soon" features described as if they already work.
 *
 * This renders on the server, so its strings arrive as a prop rather than
 * through useT(): that hook reads a client context, and the provider is
 * mounted in the (app) layout, which this page sits outside of. The provider
 * is mounted here too, but only so the switcher in the header knows which
 * language is currently showing.
 */
export function Marketing({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <LocaleProvider locale={locale}>
      <div className="bg-paper">
        <Header t={t} />
        <Hero t={t} />
        <HowAIIsUsed t={t} />
        <Features t={t} />
        <HowItWorks t={t} />
        <ClosingCTA t={t} />
        <Footer t={t} />
      </div>
    </LocaleProvider>
  );
}

function Header({ t }: { t: Dictionary }) {
  return (
    <header className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 px-5 sm:px-6 py-6">
      <Link href="/" aria-label={t.marketing.home}>
        <FreelyLogo size="sm" />
      </Link>
      <nav className="flex items-center gap-3 sm:gap-4">
        <LanguageSwitcher compact />
        <Link href="/signin" className="font-body font-semibold text-sm text-slate">
          {t.marketing.logIn}
        </Link>
        <Link
          href="/signup"
          className="font-body font-bold text-sm text-white bg-violet px-4 py-2.5 rounded-lg"
        >
          {t.marketing.signUpFree}
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing-hero.png"
        alt={t.marketing.heroImageAlt}
        className="w-full rounded-card border border-line shadow-panel mt-10"
      />
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

function HowAIIsUsed({ t }: { t: Dictionary }) {
  const points = [
    { title: t.marketing.aiContextTitle, body: t.marketing.aiContextBody },
    { title: t.marketing.aiReviewTitle, body: t.marketing.aiReviewBody },
    { title: t.marketing.aiDisclosureTitle, body: t.marketing.aiDisclosureBody },
    { title: t.marketing.aiPricingTitle, body: t.marketing.aiPricingBody },
  ];

  return (
    <section className="max-w-3xl mx-auto px-5 sm:px-6 py-12 sm:py-14 border-t border-line">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-1.5 text-caption font-bold text-violet uppercase tracking-wide mb-3">
          <Sparkles size={13} /> {t.marketing.aiEyebrow}
        </div>
        <h2 className="font-display italic text-3xl text-ink m-0">{t.marketing.aiTitle}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {points.map((p) => (
          <div key={p.title}>
            <div className="font-body font-bold text-lead text-ink mb-1.5">{p.title}</div>
            <div className="text-slate text-body leading-relaxed">{p.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features({ t }: { t: Dictionary }) {
  const items = [
    {
      icon: FileText,
      title: t.marketing.featureQuotesTitle,
      body: t.marketing.featureQuotesBody,
    },
    {
      icon: ListChecks,
      title: t.marketing.featureTrackingTitle,
      body: t.marketing.featureTrackingBody,
    },
    {
      icon: Users,
      title: t.marketing.featureDiaryTitle,
      body: t.marketing.featureDiaryBody,
    },
  ];

  return (
    <section className="max-w-4xl mx-auto px-5 sm:px-6 py-12 sm:py-14 border-t border-line">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {items.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-white border border-line rounded-card px-5 py-6">
            <div className="w-9 h-9 rounded-lg bg-violet-tint flex items-center justify-center text-violet mb-3">
              <Icon size={17} />
            </div>
            <div className="font-body font-bold text-lead text-ink mb-1.5">{title}</div>
            <div className="text-slate text-small leading-relaxed">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks({ t }: { t: Dictionary }) {
  const steps = [
    { n: "1", title: t.marketing.step1Title, body: t.marketing.step1Body },
    { n: "2", title: t.marketing.step2Title, body: t.marketing.step2Body },
    { n: "3", title: t.marketing.step3Title, body: t.marketing.step3Body },
  ];
  return (
    <section className="max-w-3xl mx-auto px-5 sm:px-6 py-12 sm:py-14 border-t border-line">
      <h2 className="font-display italic text-3xl text-ink text-center m-0 mb-10">
        {t.marketing.howItWorks}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {steps.map((s) => (
          <div key={s.n} className="text-center">
            <div className="w-8 h-8 rounded-full bg-coral text-white font-body font-bold text-sm flex items-center justify-center mx-auto mb-3">
              {s.n}
            </div>
            <div className="font-body font-bold text-lead text-ink mb-1">{s.title}</div>
            <div className="text-slate text-small leading-relaxed">{s.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClosingCTA({ t }: { t: Dictionary }) {
  return (
    <section className="max-w-2xl mx-auto text-center px-5 sm:px-6 py-12 sm:py-16 border-t border-line">
      <div className="flex items-center justify-center gap-2 text-text-muted text-meta mb-4">
        <ShieldCheck size={14} /> {t.marketing.freeToStart}
      </div>
      <h2 className="font-display italic text-3xl text-ink m-0">{t.marketing.tryIt}</h2>
      <Link
        href="/signup"
        className="inline-block font-body font-bold text-sm text-white bg-violet px-6 py-3.5 rounded-lg mt-6"
      >
        {t.marketing.getStarted}
      </Link>
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
