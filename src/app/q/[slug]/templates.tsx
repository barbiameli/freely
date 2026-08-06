import { currencySymbol } from "@/lib/currencies";

interface Strategy {
  goal: string;
  findings: string[];
  aiWill: string[];
  aiWillNot: string[];
  openQuestions: string[];
}

interface Example {
  name: string;
  dataUrl: string;
  caption: string;
}

export interface PublicBrief {
  title: string;
  client: string;
  scope: string;
  deliverables: string[];
  timeline: string;
  strategy: Strategy | null;
  price: number;
  hours: number;
  hourlyRate?: number | null;
  currency?: string | null;
  examples: Example[];
}

export interface BrandProps {
  primary: string;
  accent: string;
  logoDataUrl?: string | null;
}

function ExampleGallery({ examples, tint }: { examples: Example[]; tint?: string }) {
  if (examples.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-4">
      {examples.map((ex, i) => (
        <div key={i} className="rounded-lg overflow-hidden border border-line" style={tint ? { background: tint } : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ex.dataUrl} alt={ex.name} className="w-full h-[140px] object-cover" />
          <div className="p-3">
            <div className="text-[12px] font-bold text-ink">{ex.name}</div>
            <p className="text-[12px] text-slate mt-1 leading-relaxed m-0">{ex.caption}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Classic — the default card look, cleaned up with real section backgrounds
 * and bullets instead of a flat scroll of text. */
export function ClassicTemplate({ brief, brand }: { brief: PublicBrief; brand: BrandProps }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white border border-line rounded-card shadow-panel overflow-hidden">
        <div className="bg-paper px-8 py-5 flex items-center justify-between">
          {brand.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoDataUrl} alt="" className="h-8" />
          ) : (
            <span className="font-display italic text-2xl" style={{ color: brand.primary }}>
              Freely
            </span>
          )}
          <span className="font-label text-xs text-slate uppercase">Quote</span>
        </div>
        <div className="p-9 flex flex-col gap-4">
          <div>
            <h1 className="font-display italic text-3xl m-0" style={{ color: brand.primary }}>
              {brief.title}
            </h1>
            <p className="text-slate text-sm mt-1.5">{brief.client}</p>
          </div>

          {brief.strategy && (
            <div className="rounded-lg p-4" style={{ background: "rgba(99,32,238,0.07)" }}>
              <div className="font-label text-xs text-slate uppercase mb-2">Strategy</div>
              <p className="text-[13.5px] text-ink m-0 leading-relaxed font-medium">{brief.strategy.goal}</p>
              {brief.strategy.findings.length > 0 && (
                <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-1">
                  {brief.strategy.findings.map((f, i) => (
                    <li key={i} className="text-[13px] text-ink leading-relaxed">
                      · {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-lg p-4 bg-paper">
            <div className="font-label text-xs text-slate uppercase mb-2">Scope</div>
            <p className="text-[13.5px] text-ink m-0 leading-relaxed">{brief.scope}</p>
          </div>

          <div className="rounded-lg p-4" style={{ background: "rgba(244,91,105,0.08)" }}>
            <div className="font-label text-xs text-slate uppercase mb-2">Deliverables</div>
            <div className="flex flex-col gap-1.5">
              {brief.deliverables.map((d, i) => (
                <div key={i} className="text-[13.5px] text-ink font-medium">
                  ✓ {d}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg p-4 bg-paper">
            <div className="font-label text-xs text-slate uppercase mb-2">Timeline</div>
            <p className="text-[13.5px] text-ink m-0">{brief.timeline}</p>
          </div>

          {brief.examples.length > 0 && (
            <div>
              <div className="font-label text-xs text-slate uppercase mb-2">Examples</div>
              <ExampleGallery examples={brief.examples} />
            </div>
          )}

          <div className="rounded-lg p-4 bg-ink flex justify-between items-center">
            <span className="text-[13.5px] text-white/70">
              {brief.hours} hours
              {brief.hourlyRate ? ` · ~${currencySymbol(brief.currency)}${brief.hourlyRate}/hr` : ""}
            </span>
            <span className="font-body font-bold text-[22px] text-white">
              {currencySymbol(brief.currency)}{brief.price.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Editorial — magazine-style: large serif headline, generous whitespace,
 * full-bleed sections divided by thin colored rules instead of cards. */
export function EditorialTemplate({ brief, brand }: { brief: PublicBrief; brand: BrandProps }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-10 py-16">
        <div className="flex items-center justify-between mb-14">
          {brand.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoDataUrl} alt="" className="h-7" />
          ) : (
            <span className="font-display italic text-xl" style={{ color: brand.primary }}>
              Freely
            </span>
          )}
          <span className="text-[10px] tracking-[0.15em] uppercase text-slate">Quotation</span>
        </div>

        <span className="text-[11px] tracking-[0.15em] uppercase" style={{ color: brand.primary }}>
          For {brief.client}
        </span>
        <h1 className="font-display italic text-[44px] leading-[1.1] m-0 mt-3 text-ink">
          {brief.title}
        </h1>

        <div className="flex gap-10 mt-10 pb-10 border-b" style={{ borderColor: brand.accent }}>
          <div>
            <div className="font-body font-bold text-[26px] text-ink">{currencySymbol(brief.currency)}{brief.price.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-slate mt-1">Total</div>
          </div>
          <div>
            <div className="font-body font-bold text-[26px] text-ink">{brief.hours}h</div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-slate mt-1">Estimated hours</div>
          </div>
          {brief.hourlyRate && (
            <div>
              <div className="font-body font-bold text-[26px] text-ink">{currencySymbol(brief.currency)}{brief.hourlyRate}</div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-slate mt-1">Per hour</div>
            </div>
          )}
        </div>

        {brief.strategy && (
          <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
            <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
              Strategy
            </h2>
            <p className="text-[15px] leading-relaxed text-ink">{brief.strategy.goal}</p>
            {brief.strategy.findings.length > 0 && (
              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-[0.1em] text-slate mb-2">Findings</div>
                <ul className="list-none p-0 m-0 flex flex-col gap-2">
                  {brief.strategy.findings.map((f, i) => (
                    <li key={i} className="text-[14px] text-ink leading-relaxed pl-4 relative">
                      <span className="absolute left-0" style={{ color: brand.primary }}>—</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
          <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
            Scope
          </h2>
          <p className="text-[15px] leading-relaxed text-ink">{brief.scope}</p>
        </div>

        <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
          <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
            Deliverables
          </h2>
          <div className="flex flex-col gap-2.5">
            {brief.deliverables.map((d, i) => (
              <div key={i} className="text-[14.5px] text-ink flex items-baseline gap-3">
                <span className="text-[11px] tabular-nums text-slate w-5">{String(i + 1).padStart(2, "0")}</span>
                {d}
              </div>
            ))}
          </div>
        </div>

        <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
          <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
            Timeline
          </h2>
          <p className="text-[15px] leading-relaxed text-ink">{brief.timeline}</p>
        </div>

        {brief.examples.length > 0 && (
          <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
            <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
              Examples
            </h2>
            <ExampleGallery examples={brief.examples} />
          </div>
        )}

        <div className="flex justify-end items-baseline pt-10">
          <span className="font-display italic text-[32px]" style={{ color: brand.accent }}>
            {currencySymbol(brief.currency)}{brief.price.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Minimal — plain, high-contrast, no shadows or card chrome; letter-spaced
 * labels and hairline rules do the separating instead of color blocks. */
export function MinimalTemplate({ brief, brand }: { brief: PublicBrief; brand: BrandProps }) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <div className="max-w-xl mx-auto px-8 py-14">
        <div className="flex items-center justify-between pb-6 border-b border-ink">
          {brand.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoDataUrl} alt="" className="h-6" />
          ) : (
            <span className="text-sm font-bold tracking-[0.08em] uppercase">Freely</span>
          )}
          <span className="text-[10px] tracking-[0.15em] uppercase text-slate">Quote</span>
        </div>

        <h1 className="text-[24px] font-bold m-0 mt-8">{brief.title}</h1>
        <p className="text-[13px] text-slate mt-1">{brief.client}</p>

        <div className="flex gap-8 mt-6 pb-6 border-b border-line text-[13px]">
          <span>
            <strong>{currencySymbol(brief.currency)}{brief.price.toLocaleString()}</strong> total
          </span>
          <span>
            <strong>{brief.hours}h</strong> estimated
          </span>
          {brief.hourlyRate && (
            <span>
              <strong>{currencySymbol(brief.currency)}{brief.hourlyRate}</strong>/hr
            </span>
          )}
        </div>

        {brief.strategy && (
          <div className="py-6 border-b border-line">
            <div className="text-[11px] font-bold tracking-[0.1em] uppercase mb-2">Strategy</div>
            <p className="text-[13.5px] leading-relaxed m-0">{brief.strategy.goal}</p>
            {brief.strategy.findings.map((f, i) => (
              <p key={i} className="text-[13px] leading-relaxed m-0 mt-2 pl-4 border-l border-line">
                {f}
              </p>
            ))}
          </div>
        )}

        <div className="py-6 border-b border-line">
          <div className="text-[11px] font-bold tracking-[0.1em] uppercase mb-2">Scope</div>
          <p className="text-[13.5px] leading-relaxed m-0">{brief.scope}</p>
        </div>

        <div className="py-6 border-b border-line">
          <div className="text-[11px] font-bold tracking-[0.1em] uppercase mb-2">Deliverables</div>
          <div className="flex flex-col gap-1">
            {brief.deliverables.map((d, i) => (
              <div key={i} className="text-[13.5px]">
                — {d}
              </div>
            ))}
          </div>
        </div>

        <div className="py-6 border-b border-line">
          <div className="text-[11px] font-bold tracking-[0.1em] uppercase mb-2">Timeline</div>
          <p className="text-[13.5px] leading-relaxed m-0">{brief.timeline}</p>
        </div>

        {brief.examples.length > 0 && (
          <div className="py-6 border-b border-line">
            <div className="text-[11px] font-bold tracking-[0.1em] uppercase mb-2">Examples</div>
            <ExampleGallery examples={brief.examples} />
          </div>
        )}

        <div className="flex justify-between items-center pt-6">
          <span className="text-[13px] text-slate">Total</span>
          <span className="text-[22px] font-bold">{currencySymbol(brief.currency)}{brief.price.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
