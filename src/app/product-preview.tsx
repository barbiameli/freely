import { FreelyLogo } from "@/components/freely-logo";
import type { Dictionary } from "@/lib/i18n";

/**
 * The product, on the marketing page, drawn rather than photographed.
 *
 * This replaced a PNG screenshot, for three reasons. The screenshot was of a
 * real account, so it put real client names and real prices on a public page.
 * It was out of date within weeks: the one it replaced still showed a three
 * step wizard months after the wizard became two steps, and nothing fails when
 * that happens. And it was flat pixels at 1x, so it was soft on a good screen.
 *
 * Drawn in markup it is sharp at any size, the clients are invented, and the
 * labels come from the same dictionary as the real interface, so it says
 * whatever the app says and it is already in both languages.
 *
 * These are likenesses, not the real component tree. That is the tradeoff:
 * they can still drift from the real screens, slowly, and by shape rather than
 * by wording.
 *
 * One invented studio runs through all four, so the page reads as one
 * freelancer's week rather than four unrelated mockups.
 */
const CLIENTS = {
  aurora: "Aurora Café",
  meridian: "Meridian",
  northwind: "Northwind",
};

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      // Decorative: everything here is also said in the copy beside it, so a
      // screen reader announcing the whole mock would only repeat it.
      aria-hidden="true"
      className="w-full rounded-card border border-line bg-white shadow-panel overflow-hidden text-left select-none"
    >
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-line bg-paper">
        <span className="w-2 h-2 rounded-full bg-line" />
        <span className="w-2 h-2 rounded-full bg-line" />
        <span className="w-2 h-2 rounded-full bg-line" />
        <span className="ml-2 text-[9px] tracking-[0.12em] uppercase text-text-muted truncate">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/** The hero: the quote list, with a sidebar, so the whole app is legible at a glance. */
export function ProductPreview({ t }: { t: Dictionary }) {
  const navLabels = [t.nav.quote, t.nav.track, t.nav.diary, t.nav.invoices, t.nav.memory];
  const quotes = [
    { title: `${CLIENTS.aurora}, brand refresh`, price: "£2,400", tracked: true },
    { title: `${CLIENTS.meridian}, onboarding flow`, price: "£3,200", tracked: false },
    { title: `${CLIENTS.northwind}, design system`, price: "£1,800", tracked: false },
  ];

  return (
    <div
      aria-hidden="true"
      className="w-full rounded-card border border-line bg-white shadow-panel overflow-hidden flex text-left select-none"
    >
      <div className="hidden sm:flex flex-col items-center gap-3 w-[68px] shrink-0 border-r border-line py-4">
        <div className="scale-[0.62] origin-top">
          <FreelyLogo size="sm" />
        </div>
        {(["Q", "T", "D", "I", "M"] as const).map((letter, i) => (
          <div key={letter} className="flex flex-col items-center gap-0.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-body font-bold text-caption ${
                i === 0 ? "bg-violet-tint text-violet" : "border border-line text-text-muted"
              }`}
            >
              {letter}
            </div>
            <span
              className={`text-[8px] leading-none ${
                i === 0 ? "text-violet font-semibold" : "text-text-muted"
              }`}
            >
              {navLabels[i]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 min-w-0 px-5 sm:px-7 py-5 sm:py-6">
        <div className="text-[9px] sm:text-caption tracking-[0.12em] uppercase text-text-muted mb-4">
          {t.quote.eyebrowStep1}
        </div>

        <div className="flex items-center gap-1 border-b border-line mb-5">
          <span className="font-body font-semibold text-small text-ink px-3 pb-2 border-b-2 border-b-violet -mb-px">
            {t.quote.allQuotes}
          </span>
          <span className="font-body font-semibold text-small text-text-muted px-3 pb-2">
            {t.quote.newQuote}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quotes.map((quote) => (
            <div key={quote.title} className="border border-line rounded-lg overflow-hidden">
              <div className="bg-ink px-3 py-3 flex flex-col gap-1.5">
                <div className="w-6 h-[3px] rounded-full bg-coral" />
                <div className="w-4/5 h-[5px] rounded-full bg-white/85" />
                <div className="w-3/5 h-[4px] rounded-full bg-white/35" />
              </div>
              <div className="px-3 py-2.5">
                <div className="font-body font-semibold text-caption text-ink leading-snug line-clamp-2">
                  {quote.title}
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="font-body font-bold text-caption text-ink tabular-nums">
                    {quote.price}
                  </span>
                  <span
                    className={`text-[9px] font-semibold ${
                      quote.tracked ? "text-text-muted" : "text-violet"
                    }`}
                  >
                    {quote.tracked ? t.quote.tracked : t.quote.sendToTrack}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Quoting: the priced result, since that is what the section promises. */
export function QuotePreview({ t }: { t: Dictionary }) {
  const lines = [
    { name: "Discovery and audit", hours: "8h", price: "£560" },
    { name: "Visual direction", hours: "12h", price: "£840" },
    { name: "Page designs", hours: "18h", price: "£1,260" },
  ];

  return (
    <Frame label={`${CLIENTS.aurora}, brand refresh`}>
      <div className="px-5 py-5">
        <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-line">
          <span className="font-body font-bold text-small text-ink">{t.quote.output}</span>
          <span className="font-display italic text-2xl text-coral tabular-nums">£2,400</span>
        </div>
        <div className="flex flex-col">
          {lines.map((line) => (
            <div
              key={line.name}
              className="flex items-baseline justify-between gap-3 py-2.5 border-b border-line last:border-b-0"
            >
              <span className="text-small text-slate min-w-0 truncate">{line.name}</span>
              <span className="flex items-baseline gap-3 shrink-0">
                <span className="text-caption text-text-muted tabular-nums">{line.hours}</span>
                <span className="font-body font-semibold text-caption text-ink tabular-nums w-14 text-right">
                  {line.price}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3.5">
          <span className="text-[9px] font-bold uppercase tracking-wide text-violet bg-violet-tint rounded-full px-2 py-1">
            {t.quote.sectionSow}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wide text-slate bg-paper border border-line rounded-full px-2 py-1">
            {t.quote.sectionTimeline}
          </span>
        </div>
      </div>
    </Frame>
  );
}

/** Tracking: several projects at once, which is the whole point of the view. */
export function TrackPreview({ t }: { t: Dictionary }) {
  const projects = [
    { name: `${CLIENTS.aurora}, brand refresh`, done: 0.65, meta: "4/6", late: false },
    { name: `${CLIENTS.meridian}, onboarding flow`, done: 0.3, meta: "2/7", late: true },
    { name: `${CLIENTS.northwind}, design system`, done: 0.85, meta: "6/7", late: false },
  ];

  return (
    <Frame label={t.nav.track}>
      <div className="px-5 py-5">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: t.track.done, value: "58%" },
            { label: t.track.pace, value: t.track.paceOnTrack, small: true },
            { label: t.track.hours, value: "96" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg bg-ink px-3 py-2.5">
              <div className="text-[8px] uppercase tracking-wide text-white/70 truncate">
                {stat.label}
              </div>
              <div
                className={`font-body font-bold text-white tabular-nums mt-0.5 ${
                  stat.small ? "text-caption" : "text-lead"
                }`}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          {projects.map((project) => (
            <div key={project.name} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-caption text-slate truncate">
                {project.name}
              </span>
              <span className="w-20 h-[4px] rounded-full bg-line overflow-hidden shrink-0">
                <span
                  className={`block h-full rounded-full ${
                    project.late ? "bg-overdue" : "bg-violet"
                  }`}
                  style={{ width: `${project.done * 100}%` }}
                />
              </span>
              <span className="text-[9px] text-text-muted tabular-nums w-7 text-right shrink-0">
                {project.meta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Client reporting: what the client sees, so it is shown from their side. */
export function ReportPreview({ t }: { t: Dictionary }) {
  const entries = [
    { day: "Thu", text: "Checkout flow redesigned, ready for your review." },
    { day: "Tue", text: "Audit finished. Three drop-off points worth fixing first." },
    { day: "Mon", text: "Kick-off. Access to analytics confirmed." },
  ];

  return (
    <Frame label={t.nav.diary}>
      <div className="px-5 py-5">
        <div className="flex items-center gap-2 pb-3 mb-1 border-b border-line">
          <span className="w-5 h-5 rounded-md bg-coral flex items-center justify-center text-white font-body font-bold text-[9px]">
            A
          </span>
          <span className="font-body font-semibold text-caption text-ink truncate">
            {CLIENTS.aurora}
          </span>
        </div>
        <div className="flex flex-col">
          {entries.map((entry, i) => (
            <div key={entry.text} className="flex gap-3 py-2.5">
              <div className="flex flex-col items-center shrink-0 pt-1">
                <span
                  className={`w-2 h-2 rounded-full ${i === 0 ? "bg-violet" : "bg-line"}`}
                />
                {i < entries.length - 1 && <span className="w-px flex-1 bg-line mt-1" />}
              </div>
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-wide text-text-muted">
                  {entry.day}
                </div>
                <div className="text-caption text-slate leading-snug mt-0.5">{entry.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Invoicing: the document, with the total doing the talking. */
export function InvoicePreview({ t }: { t: Dictionary }) {
  return (
    <Frame label={t.nav.invoices}>
      <div className="px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display italic text-xl text-ink">INV-014</div>
            <div className="text-[9px] text-text-muted mt-0.5">{CLIENTS.northwind}</div>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wide text-violet bg-violet-tint rounded-full px-2 py-1">
            {t.quote.published}
          </span>
        </div>

        <div className="mt-4 flex flex-col">
          {[
            { name: "Design system, phase one", price: "£1,800" },
            { name: "Additional components", price: "£420" },
          ].map((line) => (
            <div
              key={line.name}
              className="flex items-baseline justify-between gap-3 py-2 border-b border-line"
            >
              <span className="text-caption text-slate min-w-0 truncate">{line.name}</span>
              <span className="text-caption text-ink tabular-nums shrink-0">{line.price}</span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 pt-3">
            <span className="font-body font-bold text-small text-ink">£2,220</span>
            <span className="text-[9px] text-text-muted">14 days</span>
          </div>
        </div>
      </div>
    </Frame>
  );
}
