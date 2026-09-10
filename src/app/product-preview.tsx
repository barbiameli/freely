"use client";

import { FreelyLogo } from "@/components/freely-logo";
import { useInView, Tally, StaggerItem } from "./reveal";
import { fill, type Dictionary } from "@/lib/i18n";

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
/** Invented, and not a word in any language, so it needs no translation. */
const INVOICE_NUMBER = "INV-014";

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
                  i === 0 ? "bg-violet-tint text-link" : "border border-line text-text-muted"
                }`}
              >
                {letter}
              </div>
              <span
                className={`text-[8px] leading-none ${
                  i === 0 ? "text-link font-semibold" : "text-text-muted"
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
                        quote.tracked ? "text-text-muted" : "text-link"
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
              <span className="text-[9px] font-bold uppercase tracking-wide text-link bg-violet-tint rounded-full px-2 py-1">
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
              <div className="font-display italic text-xl text-ink">{INVOICE_NUMBER}</div>
              <div className="text-[9px] text-text-muted mt-0.5">{CLIENTS.northwind}</div>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wide text-link bg-violet-tint rounded-full px-2 py-1">
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
                <span className="text-[9px] text-text-muted">{fill(t.invoices.dueInDays, { days: 14 })}</span>
              </div>
            </StaggerItem>
          </div>
        </div>
      </Frame>
    </div>
  );
}

/**
 * The board: three columns, the cards arriving into them, one clock running.
 *
 * The Track preview above it answers "how are my projects doing" across the
 * whole week. This one answers "what am I doing this afternoon", which is a
 * different question and the one the board was built for, so it gets its own
 * picture rather than being folded into that one.
 *
 * The running card is the point of the whole thing, so it is the only card
 * carrying the accent and it is in Doing, where a clock can honestly be.
 */
export function BoardPreview({ t }: { t: Dictionary }) {
  const { ref, inView } = useInView();

  const columns: { label: string; cards: { name: string; hours: string; running?: boolean }[] }[] =
    [
      {
        label: t.track.boardTodo,
        cards: [
          { name: "Pricing page copy", hours: "3h" },
          { name: "Mobile nav states", hours: "2h" },
        ],
      },
      {
        label: t.track.boardDoing,
        cards: [{ name: "Homepage layout", hours: "0:42", running: true }],
      },
      {
        label: t.track.boardDone,
        cards: [
          { name: "Brand audit", hours: "5h" },
          { name: "Sitemap", hours: "1h" },
        ],
      },
    ];

  return (
    <div ref={ref}>
      <Frame label={t.nav.track}>
        <div className="grid grid-cols-3 gap-2 px-3 py-4">
          {columns.map((column, columnIndex) => (
            <div key={column.label} className="rounded-lg bg-paper p-2">
              <div className="text-[8px] uppercase tracking-[0.1em] text-text-muted mb-2 truncate">
                {column.label}
              </div>
              <div className="flex flex-col gap-1.5">
                {column.cards.map((card, cardIndex) => (
                  <StaggerItem
                    key={card.name}
                    // Left to right, so it reads as work moving across rather
                    // than three lists appearing at once.
                    index={columnIndex * 2 + cardIndex}
                    start={inView}
                    step={110}
                  >
                    <div className="rounded-md bg-white border border-line px-2 py-1.5 flex items-start gap-1.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9px] font-semibold text-ink leading-snug">
                          {card.name}
                        </span>
                        <span className="block text-[8px] text-text-muted tabular-nums mt-0.5">
                          {card.hours}
                        </span>
                      </span>
                      {card.running && (
                        <span className="shrink-0 w-3.5 h-3.5 rounded-full bg-violet flex items-center justify-center">
                          <span className="w-1 h-1 rounded-full bg-ink" />
                        </span>
                      )}
                    </div>
                  </StaggerItem>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Frame>
    </div>
  );
}

/**
 * The timeline: deliverables as parent bars, with their tasks nested under.
 *
 * Drawn as bars of different lengths starting on different days, because the
 * complaint the planner exists to answer is a chart that gives everything one
 * day and calls it a plan. A picture of that failure would sell the wrong
 * thing.
 */
export function TimelinePreview({ t }: { t: Dictionary }) {
  const { ref, inView } = useInView();

  // start and span are in columns out of twelve.
  const bars = [
    { name: "Discovery", start: 0, span: 3, parent: true },
    { name: "Interviews", start: 0, span: 2, parent: false },
    { name: "Design", start: 3, span: 6, parent: true },
    { name: "Homepage", start: 3, span: 4, parent: false },
    { name: "Build", start: 8, span: 4, parent: true },
  ];

  return (
    <div ref={ref}>
      <Frame label={t.track.viewTimeline}>
        <div className="px-4 py-4">
          <div className="flex flex-col gap-1.5">
            {bars.map((bar, i) => (
              <StaggerItem key={bar.name} index={i} start={inView} step={110}>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-16 shrink-0 truncate text-[9px] ${
                      bar.parent ? "font-semibold text-ink" : "text-text-muted pl-2"
                    }`}
                  >
                    {bar.name}
                  </span>
                  <span className="relative flex-1 h-3">
                    {/* The week, behind the bars, so a bar has something to
                        be positioned against rather than floating. */}
                    <span className="absolute inset-0 grid grid-cols-12 gap-px">
                      {Array.from({ length: 12 }).map((_, column) => (
                        <span key={column} className="bg-paper rounded-[2px]" />
                      ))}
                    </span>
                    <span
                      className={`absolute inset-y-0 rounded-full transition-[width,opacity] duration-700 ease-marketing motion-reduce:transition-none ${
                        bar.parent ? "bg-violet" : "bg-inkblue/70"
                      }`}
                      style={{
                        left: `${(bar.start / 12) * 100}%`,
                        width: inView ? `${(bar.span / 12) * 100}%` : "0%",
                        opacity: inView ? 1 : 0,
                        transitionDelay: `${i * 110}ms`,
                      }}
                    />
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
