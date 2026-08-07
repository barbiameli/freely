import Link from "next/link";
import { FileText, ListChecks, Users, ShieldCheck, Sparkles } from "lucide-react";
import { FreelyLogo } from "@/components/freely-logo";

/**
 * The public marketing page, shown at "/" to signed-out visitors only
 * (signed-in users are redirected straight to /quote — see page.tsx). Kept
 * deliberately simple and honest: every claim here matches something that
 * actually exists in the app today. No fabricated testimonials, no made-up
 * user counts, no "coming soon" features described as if they already work.
 */
export function Marketing() {
  return (
    <div className="bg-paper">
      <Header />
      <Hero />
      <HowAIIsUsed />
      <Features />
      <HowItWorks />
      <ClosingCTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="max-w-5xl mx-auto flex items-center justify-between px-6 py-6">
      <FreelyLogo size="sm" />
      <nav className="flex items-center gap-4">
        <Link href="/signin" className="font-body font-semibold text-sm text-slate">
          Log in
        </Link>
        <Link
          href="/signup"
          className="font-body font-bold text-sm text-white bg-violet px-4 py-2.5 rounded-lg"
        >
          Sign up free
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="max-w-4xl mx-auto text-center px-6 pt-10 pb-16">
      <h1 className="font-display italic text-[44px] leading-[1.1] text-ink m-0">
        Quote, track, and report on client work, <span className="text-coral">without the busywork.</span>
      </h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/flourish.svg" alt="" aria-hidden="true" className="w-16 mx-auto mt-4 mb-2" />
      <p className="text-slate text-[16px] mt-4 max-w-lg mx-auto">
        Freely is one place for a freelancer to turn a client brief into a priced quote, track the
        project once it&apos;s won, and keep a running diary the client can see, with AI drafting
        the first pass of each quote from your own rates and past work.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marketing-hero.png"
        alt="The Quote wizard in Freely, showing the first step where you paste or upload a client brief."
        className="w-full rounded-card border border-line shadow-panel mt-10"
      />
      <div className="flex items-center justify-center gap-3 mt-8">
        <Link
          href="/signup"
          className="font-body font-bold text-sm text-white bg-violet px-6 py-3.5 rounded-lg"
        >
          Get started for free
        </Link>
        <Link
          href="/signin"
          className="font-body font-bold text-sm text-violet bg-white border border-violet px-6 py-3.5 rounded-lg"
        >
          Log in
        </Link>
      </div>
    </section>
  );
}

function HowAIIsUsed() {
  const points = [
    {
      title: "It drafts from your own context, not a generic template",
      body: "Everything you save in Memory (your rates, past projects, tone preferences, saved files and links) is what the AI reads before writing a quote. The more you've added, the less generic it sounds.",
    },
    {
      title: "You always review before a client sees anything",
      body: "The AI writes a first draft. You edit it, refine it with a follow-up instruction, or rewrite it outright before publishing. Nothing goes out automatically.",
    },
    {
      title: "AI use is disclosed by choice, not hidden",
      body: "Every quote has an optional \"AI-use disclosure\" toggle that adds a short, honest note to the client-facing page when you turn it on. It's off by default.",
    },
    {
      title: "Pricing is reasoned, not guessed",
      body: "When you have pricing history, the AI anchors hours and price to your own past projects. When you don't, it researches typical market rates before proposing a number, and always shows its reasoning against your stated hourly rate.",
    },
  ];

  return (
    <section className="max-w-3xl mx-auto px-6 py-14 border-t border-line">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-violet uppercase tracking-wide mb-3">
          <Sparkles size={13} /> How AI is actually used
        </div>
        <h2 className="font-display italic text-3xl text-ink m-0">AI drafts. You decide.</h2>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {points.map((p) => (
          <div key={p.title}>
            <div className="font-body font-bold text-[14.5px] text-ink mb-1.5">{p.title}</div>
            <div className="text-slate text-[13.5px] leading-relaxed">{p.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: FileText,
      title: "AI-drafted quotes",
      body: "Paste or upload a client brief and get a priced, structured quote back (scope, deliverables, timeline, and an optional Strategy section) as a hosted page or downloadable PDF.",
    },
    {
      icon: ListChecks,
      title: "Project tracking",
      body: "Turn an accepted quote into a tracked project with milestones and status, all in one dashboard. No separate project-management tool needed for the basics.",
    },
    {
      icon: Users,
      title: "Client diary & reporting",
      body: "Keep a running log of project updates your client can follow, branded with your own colors and logo instead of Freely's default look.",
    },
  ];

  return (
    <section className="max-w-4xl mx-auto px-6 py-14 border-t border-line">
      <div className="grid grid-cols-3 gap-6">
        {items.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-white border border-line rounded-card px-5 py-6">
            <div className="w-9 h-9 rounded-lg bg-violet-tint flex items-center justify-center text-violet mb-3">
              <Icon size={17} />
            </div>
            <div className="font-body font-bold text-[15px] text-ink mb-1.5">{title}</div>
            <div className="text-slate text-[13px] leading-relaxed">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "1", title: "Set up Memory", body: "Add your rates, tone, past work, and (optionally) your branding, takes a few minutes." },
    { n: "2", title: "Generate a quote", body: "Drop in a client brief and get a priced, structured draft back in seconds." },
    { n: "3", title: "Review, send, track", body: "Edit anything, publish the page or PDF, then track the project once it's won." },
  ];
  return (
    <section className="max-w-3xl mx-auto px-6 py-14 border-t border-line">
      <h2 className="font-display italic text-3xl text-ink text-center m-0 mb-10">How it works</h2>
      <div className="grid grid-cols-3 gap-6">
        {steps.map((s) => (
          <div key={s.n} className="text-center">
            <div className="w-8 h-8 rounded-full bg-coral text-white font-body font-bold text-sm flex items-center justify-center mx-auto mb-3">
              {s.n}
            </div>
            <div className="font-body font-bold text-[14.5px] text-ink mb-1">{s.title}</div>
            <div className="text-slate text-[13px] leading-relaxed">{s.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="max-w-2xl mx-auto text-center px-6 py-16 border-t border-line">
      <div className="flex items-center justify-center gap-2 text-text-muted text-[12px] mb-4">
        <ShieldCheck size={14} /> Free to start, no card required.
      </div>
      <h2 className="font-display italic text-3xl text-ink m-0">Try it on your next quote.</h2>
      <Link
        href="/signup"
        className="inline-block font-body font-bold text-sm text-white bg-violet px-6 py-3.5 rounded-lg mt-6"
      >
        Get started for free
      </Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="max-w-5xl mx-auto flex items-center justify-between px-6 py-8 border-t border-line">
      <div className="flex items-center gap-2 text-text-muted text-xs">
        <FreelyLogo size="sm" />
        <span>© {new Date().getFullYear()} Freely.</span>
      </div>
      <div className="flex items-center gap-4">
        <Link href="/signin" className="font-body font-semibold text-xs text-slate">
          Log in
        </Link>
        <Link href="/signup" className="font-body font-semibold text-xs text-violet">
          Sign up
        </Link>
      </div>
    </footer>
  );
}
