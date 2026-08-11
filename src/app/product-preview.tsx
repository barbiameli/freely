"use client";

import { FreelyLogo } from "@/components/freely-logo";
import { useInView, Tally, GrowBar, StaggerItem } from "./reveal";
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
 * Being markup is also what lets them move. Each one assembles as you reach it:
 * rows arrive in sequence, totals count up, progress bars fill. A screenshot can
 * only sit there, and the thing being sold here is work progressing, which is
 * exactly what a static picture of a dashboard cannot show.
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

/**
 * The window each preview sits in.
 *
 * Lifts under the cursor. Small and slow enough to be felt rather than watched,
 * and it is the one interactive note on a page that is otherwise read: it says
 * these are pictures of software, not illustrations.
 */
function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      // Decorative: everything here is also said in the copy beside it, so a
      // screen reader announcing the whole mock would only repeat it.
      aria-hidden="true"
      className="group/frame w-full rounded-card border border-line bg-white shadow-panel overflow-hidden text-left select-none transition-[transform,box-shadow] duration-500 ease-marketing hover:-translate-y-1 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0"
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
  const { ref, inView } = useInView(0.1);
  const navLabels = [t.nav.quote, t.nav.track, t.nav.diary, t.nav.invoices, t.nav.memory];
  const quotes = [
    { title: `${CLIENTS.aurora}, brand refresh`, price: "£2,400", tracked: true },
    { title: `${CLIENTS.meridian}, onboarding flow`, price: "£3,200", tracked: false },
    { title: `${CLIENTS.northwind}, design system`, price: "£1,800", tracked: false },
  ];

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="w-full rounded-card border border-line bg-white shadow-panel overflow-hidden flex text-left select-none"
    >
      <div className="hidden sm:flex flex-col items-center gap-3 w-[68px] shrink-0 border-r border-line py-4">
        <div className="scale-[0.62] origin-top">
          <FreelyLogo size="sm" />
        </div>
        {(["Q", "T", "D", "I", "M"] as const).map((letter, i) => (
          // The nav fills in downwards, which is what draws the eye into the
          // frame rather than letting it land on the whole thing at once.
          <StaggerItem key={letter} index={i} start={inView} step={70}>
            <div className="flex flex-col items-center gap-0.5">
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
          </StaggerItem>
        ))}
      </div>

      <div className="flex-1 min-w-0 px-5 sm:px-7 py-5 sm:py-6">
        {/* No eyebrow above the tabs, because the real screen no longer has
            one: it repeated the item already lit up in the rail beside it. */}
        <div className="flex items-center gap-1 border-b border-line mb-5">
          <span className="font-body font-semibold text-small text-ink px-3 pb-2 border-b-2 border-b-violet -mb-px">
            {t.quote.allQuotes}
          </span>
          <span className="font-body font-semibold text-small text-text-muted px-3 pb-2">
            {t.quote.newQuote}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quotes.map((quote, i) => (
            <StaggerItem key={quote.title} index={i} start={inView} step={110}>
              <div className="border border-line rounded-lg overflow-hidden">
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
            </StaggerItem>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Quoting: the priced result, since that is what the section promises. */
export function QuotePreview({ t }: { t: Dictionary }) {
  const { ref, inView } = useInView();
  const lines = [
    { name: "Discovery and audit", hours: "8h", price: "£560" },
    { name: "Visual direction", hours: "12h", price: "£840" },
    { name: "Page designs", hours: "18h", price: "£1,260" },
  ];

  return (
    <div ref={ref}>
      <Frame label={`${CLIENTS.aurora}, brand refresh`}>
        <div className="px-5 py-5">
          <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-line">
            <span className="font-body font-bold text-small text-ink">{t.quote.output}</span>
            {/* The total counts up, because the total is the promise of the
                section: a price arrived at rather than a number printed. */}
            <span className="font-display italic text-2xl text-coral tabular-nums">
              <Tally value={2400} prefix="£" start={inView} />
            </span>
          </div>
          <div className="flex flex-col">
            {lines.map((line, i) => (
              <StaggerItem
                key={line.name}
                index={i}
                start={inView}
                step={110}
                className="border-b border-line last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="text-small text-slate min-w-0 truncate">{line.name}</span>
                  <span className="flex items-baseline gap-3 shrink-0">
                    <span className="text-caption text-text-muted tabular-nums">{line.hours}</span>
                    <span className="font-body font-semibold text-caption text-ink tabular-nums w-14 text-right">
                      {line.price}
                    </span>
                  </span>
                </div>
              </StaggerItem>
            ))}
          </div>
          <StaggerItem index={4} start={inView} step={110}>
            <div className="flex items-center gap-2 mt-3.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-violet bg-violet-tint rounded-full px-2 py-1">
                {t.quote.sectionSow}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-slate bg-paper border border-line rounded-full px-2 py-1">
                {t.quote.sectionTimeline}
              </span>
            </div>
          </StaggerItem>
        </div>
      </Frame>
    </div>
  );
}

/** Tracking: several projects at once, which is the whole point of the view. */
export function TrackPreview({ t }: { t: Dictionary }) {
  const { ref, inView } = useInView();
  // Typed rather than inferred: two of these three stats are numbers that count
  // up and one is a word, and an inferred union of those two shapes cannot be
  // read from without narrowing at every use.
  const stats: {
    label: string;
    /** A number to count up to, for the two that are numbers. */
    tally?: number;
    suffix?: string;
    /** Or a word, for Pace, which is not a quantity. */
    text?: string;
    small?: boolean;
  }[] = [
    { label: t.track.done, tally: 58, suffix: "%" },
    { label: t.track.pace, text: t.track.paceOnTrack, small: true },
    { label: t.track.hours, tally: 96 },
  ];
  const projects = [
    { name: `${CLIENTS.aurora}, brand refresh`, done: 0.65, meta: "4/6", late: false },
    { name: `${CLIENTS.meridian}, onboarding flow`, done: 0.3, meta: "2/7", late: true },
    { name: `${CLIENTS.northwind}, design system`, done: 0.85, meta: "6/7", late: false },
  ];

  return (
    <div ref={ref}>
      <Frame label={t.nav.track}>
        <div className="px-5 py-5">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {stats.map((stat, i) => (
              <StaggerItem key={stat.label} index={i} start={inView} step={90}>
                <div className="rounded-lg bg-ink px-3 py-2.5">
                  <div className="text-[8px] uppercase tracking-wide text-white/70 truncate">
                    {stat.label}
                  </div>
                  <div
                    className={`font-body font-bold text-white tabular-nums mt-0.5 ${
                      stat.small ? "text-caption" : "text-lead"
                    }`}
                  >
                    {stat.text ?? (
                      <Tally value={stat.tally ?? 0} suffix={stat.suffix ?? ""} start={inView} />
                    )}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            {projects.map((project, i) => (
              <StaggerItem key={project.name} index={i} start={inView} step={110}>
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 text-caption text-slate truncate">
                    {project.name}
                  </span>
                  {/* The bars fill rather than appear. Three projects at
                      different lengths arriving at different moments is the
                      difference between reading progress and reading a chart. */}
                  <span className="w-20 h-[4px] rounded-full bg-line overflow-hidden shrink-0">
                    <GrowBar
                      fraction={project.done}
                      color={project.late ? "bg-overdue" : "bg-violet"}
                      start={inView}
                      delay={260 + i * 110}
                    />
                  </span>
                  <span className="text-[9px] text-text-muted tabular-nums w-7 text-right shrink-0">
                    {project.meta}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </div>
        </div>
      </Frame>
    </div>
  );
}

/** Client reporting: what the client sees, so it is shown from their side. */
export function ReportPreview({ t }: { t: Dictionary }) {
  const { ref, inView } = useInView();
  const entries = [
    { day: "Thu", text: "Checkout flow redesigned, ready for your review." },
    { day: "Tue", text: "Audit finished. Three drop-off points worth fixing first." },
    { day: "Mon", text: "Kick-off. Access to analytics confirmed." },
  ];

  return (
    <div ref={ref}>
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
              // Newest first, so the updates arrive the way they were written:
              // the top one first, then back through the week.
              <StaggerItem key={entry.text} index={i} start={inView} step={140}>
                <div className="flex gap-3 py-2.5">
                  <div className="flex flex-col items-center shrink-0 pt-1">
                    <span className={`w-2 h-2 rounded-full ${i === 0 ? "bg-violet" : "bg-line"}`} />
                    {i < entries.length - 1 && <span className="w-px flex-1 bg-line mt-1" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase tracking-wide text-text-muted">
                      {entry.day}
                    </div>
                    <div className="text-caption text-slate leading-snug mt-0.5">{entry.text}</div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </div>
        </div>
      </Frame>
    </div>
  );
}

/** Invoicing: the document, with the total doing the talking. */
export function InvoicePreview({ t }: { t: Dictionary }) {
  const { ref, inView } = useInView();
  const lines = [
    { name: "Design system, phase one", price: "£1,800" },
    { name: "Additional components", price: "£420" },
  ];

  return (
    <div ref={ref}>
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
            {lines.map((line, i) => (
              <StaggerItem
                key={line.name}
                index={i}
                start={inView}
                step={120}
                className="border-b border-line"
              >
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-caption text-slate min-w-0 truncate">{line.name}</span>
                  <span className="text-caption text-ink tabular-nums shrink-0">{line.price}</span>
                </div>
              </StaggerItem>
            ))}
            <StaggerItem index={2} start={inView} step={120}>
              <div className="flex items-baseline justify-between gap-3 pt-3">
                <span className="font-body font-bold text-small text-ink tabular-nums">
                  <Tally value={2220} prefix="£" start={inView} />
                </span>
                <span className="text-[9px] text-text-muted">14 days</span>
              </div>
            </StaggerItem>
          </div>
        </div>
      </Frame>
    </div>
  );
}
