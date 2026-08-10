import { FreelyLogo } from "@/components/freely-logo";
import type { Dictionary } from "@/lib/i18n";

/**
 * The product, on the marketing page, drawn rather than photographed.
 *
 * This replaced a PNG screenshot, for three reasons. The screenshot was of a
 * real account, so it put real client names and real prices on a public page.
 * It was a year out of date within weeks: the one it replaced still showed a
 * three step wizard months after the wizard became two steps, and nothing
 * fails when that happens. And it was flat pixels, so it was soft on any
 * decent screen and needed recapturing at 2x to fix.
 *
 * Drawn in markup it is sharp at any size, the clients are invented, and the
 * labels come from the same dictionary as the real interface, so it says
 * whatever the app says and it is already in both languages.
 *
 * It is a likeness, not the real component tree. That is the tradeoff: it can
 * still drift from the real screen, just slowly, and by shape rather than by
 * wording.
 */
const SAMPLE_QUOTES = [
  { title: "Aurora Café, brand refresh", price: "£2,400", tracked: true },
  { title: "Meridian, onboarding flow", price: "£3,200", tracked: false },
  { title: "Northwind, design system", price: "£1,800", tracked: false },
];

const NAV = ["Q", "T", "D", "I", "M"] as const;

export function ProductPreview({ t }: { t: Dictionary }) {
  const navLabels = [t.nav.quote, t.nav.track, t.nav.diary, t.nav.invoices, t.nav.memory];

  return (
    <div
      // Decorative: everything in here is also said in the copy around it, so
      // a screen reader announcing the whole mock would just be repetition.
      aria-hidden="true"
      className="w-full rounded-card border border-line bg-white shadow-panel overflow-hidden flex text-left select-none"
    >
      <div className="hidden sm:flex flex-col items-center gap-3 w-[68px] shrink-0 border-r border-line py-4">
        <div className="scale-[0.62] origin-top">
          <FreelyLogo size="sm" />
        </div>
        {NAV.map((letter, i) => (
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
          {SAMPLE_QUOTES.map((quote) => (
            <div key={quote.title} className="border border-line rounded-lg overflow-hidden">
              {/* A stand-in for the quote's own cover, which is why it is
                  blocked out rather than filled with lorem text. */}
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

        <div className="mt-5 rounded-lg border border-line bg-paper px-4 py-3.5 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet flex items-center justify-center shrink-0">
            <span className="text-white font-body font-bold text-caption">+</span>
          </div>
          <div className="min-w-0">
            <div className="font-body font-semibold text-caption text-ink">{t.quote.newQuote}</div>
            <div className="text-[10px] text-text-muted truncate">{t.quote.uploadBriefHint}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
