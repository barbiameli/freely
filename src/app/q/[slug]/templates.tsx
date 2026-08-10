import { currencySymbol } from "@/lib/currencies";
import { paragraphs, splitDeliverable } from "@/lib/rich-text";
import { describeEffort, parseRateUnit, unitsFromHours } from "@/lib/rate-unit";
import { TimelineView } from "@/components/timeline-view";
import type { BriefExtras } from "@/lib/anthropic";
import { AcceptBlock } from "./accept-block";

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
  /** "HOUR" or "DAY": some freelancers quote in days. */
  rateUnit?: string | null;
  currency?: string | null;
  examples: Example[];
  extras?: BriefExtras | null;
  /** Slug and acceptance state, so a published quote can be signed off. Only
   * offered when the quote carries a Statement of Work. */
  slug: string;
  signable: boolean;
  accepted?: { name: string; at: string } | null;
}

export interface BrandProps {
  primary: string;
  accent: string;
  logoDataUrl?: string | null;
}

/** Turns the optional add-on sections into label/body pairs, so each
 * template can render them in its own style without duplicating the logic
 * that decides which ones are present. */
function extraBlocks(extras?: BriefExtras | null): [string, string][] {
  if (!extras) return [];
  const blocks: [string, string][] = [];
  if (extras.paymentTerms) blocks.push(["Payment terms", extras.paymentTerms]);
  if (extras.revisions) blocks.push(["Revisions", extras.revisions]);
  if (extras.availability) blocks.push(["Availability", extras.availability]);
  if (extras.terms) {
    blocks.push(["Cancellation", extras.terms.cancellation]);
    blocks.push(["Ownership", extras.terms.ownership]);
    blocks.push(["Confidentiality", extras.terms.confidentiality]);
  }
  if (extras.aiUsage) {
    // Two lists rather than a paragraph: a client scanning this wants to see
    // the line between what a machine touches and what it does not.
    if (extras.aiUsage.will.length) {
      blocks.push(["Where AI is used", extras.aiUsage.will.map((t) => `- ${t}`).join("\n")]);
    }
    if (extras.aiUsage.willNot.length) {
      blocks.push([
        "Where it is not",
        extras.aiUsage.willNot.map((t) => `- ${t}`).join("\n"),
      ]);
    }
  }
  return blocks;
}

/** A block of generated prose, broken into paragraphs so a long scope has
 * somewhere for the eye to rest. */
function Prose({
  text,
  className,
  color,
}: {
  text: string;
  className?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {paragraphs(text).map((p, i) => (
        <p key={i} className={`m-0 ${className ?? ""}`} style={color ? { color } : undefined}>
          {p}
        </p>
      ))}
    </div>
  );
}

function ExampleGallery({ examples, tint }: { examples: Example[]; tint?: string }) {
  if (examples.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {examples.map((ex, i) => (
        <div key={i} className="rounded-lg overflow-hidden border border-line" style={tint ? { background: tint } : undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ex.dataUrl} alt={ex.name} className="w-full h-[140px] object-cover" />
          <div className="p-3">
            <div className="text-meta font-bold text-ink">{ex.name}</div>
            <p className="text-meta text-slate mt-1 leading-relaxed m-0">{ex.caption}</p>
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
    <div className="min-h-screen bg-paper flex items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-2xl bg-white border border-line rounded-card shadow-panel overflow-hidden">
        <div className="bg-paper px-5 sm:px-8 py-5 flex items-center justify-between gap-3">
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
        <div className="p-5 sm:p-9 flex flex-col gap-4">
          <div>
            <h1 className="font-display italic text-3xl m-0" style={{ color: brand.primary }}>
              {brief.title}
            </h1>
            <p className="text-slate text-sm mt-1.5">{brief.client}</p>
          </div>

          {brief.strategy && (
            <div className="rounded-lg p-4" style={{ background: "rgba(99,32,238,0.07)" }}>
              <div className="font-label text-xs text-slate uppercase mb-2">Strategy</div>
              <p className="text-body text-ink m-0 leading-relaxed font-medium">{brief.strategy.goal}</p>
              {brief.strategy.findings.length > 0 && (
                <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-1">
                  {brief.strategy.findings.map((f, i) => (
                    <li key={i} className="text-small text-ink leading-relaxed">
                      · {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-lg p-4 bg-paper">
            <div className="font-label text-xs text-slate uppercase mb-2">Scope</div>
            <Prose text={brief.scope} className="text-lead text-ink leading-[1.7]" />
          </div>

          <div className="rounded-lg p-4" style={{ background: "rgba(244,91,105,0.08)" }}>
            <div className="font-label text-xs text-slate uppercase mb-2">Deliverables</div>
            <div className="flex flex-col gap-1.5">
              {brief.deliverables.map((d, i) => {
                const { lead, detail } = splitDeliverable(d);
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-lead shrink-0" style={{ color: brand.accent }}>
                      ✓
                    </span>
                    <div className="min-w-0">
                      <div className="text-lead text-ink font-medium leading-snug">{lead}</div>
                      {detail && (
                        <div className="text-body text-slate leading-relaxed mt-1.5">
                          {detail}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg p-4 bg-paper">
            <div className="font-label text-xs text-slate uppercase mb-2">Timeline</div>
            <TimelineView timeline={brief.timeline} accent={brand.accent} className="text-ink" />
          </div>

          {brief.examples.length > 0 && (
            <div>
              <div className="font-label text-xs text-slate uppercase mb-2">Examples</div>
              <ExampleGallery examples={brief.examples} />
            </div>
          )}

          {extraBlocks(brief.extras).map(([label, text]) => (
            <div key={label} className="rounded-lg p-4 bg-paper">
              <div className="font-label text-xs text-slate uppercase mb-2">{label}</div>
              <p className="text-body text-ink m-0 leading-relaxed whitespace-pre-line">{text}</p>
            </div>
          ))}

          <div className="rounded-lg p-4 bg-ink flex justify-between items-center">
            <span className="text-body text-white/70">
              {describeEffort(brief.hours, parseRateUnit(brief.rateUnit))}
              {brief.hourlyRate ? ` · ~${currencySymbol(brief.currency)}${brief.hourlyRate}/hr` : ""}
            </span>
            <span className="font-body font-bold text-[22px] text-white">
              {currencySymbol(brief.currency)}{brief.price.toLocaleString()}
            </span>
          </div>

          {brief.signable && (
            <AcceptBlock
              slug={brief.slug}
              accepted={brief.accepted}
              accent={brand.accent}
            />
          )}
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
      <div className="max-w-3xl mx-auto px-5 sm:px-10 py-10 sm:py-16">
        <div className="flex items-center justify-between mb-14">
          {brand.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoDataUrl} alt="" className="h-7" />
          ) : (
            <span className="font-display italic text-xl" style={{ color: brand.primary }}>
              Freely
            </span>
          )}
          <span className="text-caption tracking-[0.15em] uppercase text-slate">Quotation</span>
        </div>

        <span className="text-caption tracking-[0.15em] uppercase" style={{ color: brand.primary }}>
          For {brief.client}
        </span>
        <h1 className="font-display italic text-[30px] sm:text-[44px] leading-[1.15] sm:leading-[1.1] m-0 mt-3 text-ink">
          {brief.title}
        </h1>

        <div className="flex flex-wrap gap-6 sm:gap-10 mt-10 pb-10 border-b" style={{ borderColor: brand.accent }}>
          <div>
            <div className="font-body font-bold text-[26px] text-ink">{currencySymbol(brief.currency)}{brief.price.toLocaleString()}</div>
            <div className="text-caption uppercase tracking-[0.08em] text-slate mt-1">Total</div>
          </div>
          <div>
            <div className="font-body font-bold text-[26px] text-ink">
              {unitsFromHours(brief.hours, parseRateUnit(brief.rateUnit))}
              {parseRateUnit(brief.rateUnit) === "DAY" ? "d" : "h"}
            </div>
            <div className="text-caption uppercase tracking-[0.08em] text-slate mt-1">
              {parseRateUnit(brief.rateUnit) === "DAY" ? "Estimated days" : "Estimated hours"}
            </div>
          </div>
          {brief.hourlyRate && (
            <div>
              <div className="font-body font-bold text-[26px] text-ink">{currencySymbol(brief.currency)}{brief.hourlyRate}</div>
              <div className="text-caption uppercase tracking-[0.08em] text-slate mt-1">Per hour</div>
            </div>
          )}
        </div>

        {brief.strategy && (
          <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
            <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
              Strategy
            </h2>
            <p className="text-lead leading-relaxed text-ink">{brief.strategy.goal}</p>
            {brief.strategy.findings.length > 0 && (
              <div className="mt-5">
                <div className="text-caption uppercase tracking-[0.1em] text-slate mb-2">Findings</div>
                <ul className="list-none p-0 m-0 flex flex-col gap-2">
                  {brief.strategy.findings.map((f, i) => (
                    <li key={i} className="text-body text-ink leading-relaxed pl-4 relative">
                      <span className="absolute left-0" style={{ color: brand.primary }}>-</span>
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
          <Prose text={brief.scope} className="text-lead leading-[1.7] text-ink" />
        </div>

        <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
          <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
            Deliverables
          </h2>
          <div className="flex flex-col gap-2.5">
            {brief.deliverables.map((d, i) => {
              const { lead, detail } = splitDeliverable(d);
              return (
                <div key={i} className="flex items-baseline gap-3">
                  <span className="text-caption tabular-nums text-slate w-5 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="text-lead text-ink leading-snug">{lead}</div>
                    {detail && (
                      <div className="text-body text-slate leading-relaxed mt-2">{detail}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
          <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
            Timeline
          </h2>
          <TimelineView timeline={brief.timeline} accent={brand.primary} className="text-ink" />
        </div>

        {brief.examples.length > 0 && (
          <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
            <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
              Examples
            </h2>
            <ExampleGallery examples={brief.examples} />
          </div>
        )}

        {extraBlocks(brief.extras).map(([label, text]) => (
          <div key={label} className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
            <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
              {label}
            </h2>
            <p className="text-lead leading-relaxed text-ink whitespace-pre-line">{text}</p>
          </div>
        ))}

        <div className="flex justify-end items-baseline pt-10">
          <span className="font-display italic text-[32px]" style={{ color: brand.accent }}>
            {currencySymbol(brief.currency)}{brief.price.toLocaleString()}
          </span>
        </div>

        {brief.signable && (
          <AcceptBlock slug={brief.slug} accepted={brief.accepted} accent={brand.accent} />
        )}
      </div>
    </div>
  );
}

/** Mono — a deliberately generic, brandless black-and-white treatment for
 * when a quote shouldn't carry either Freely's or the freelancer's own
 * colors/logo (see lib/branding.ts). Light and dark are the same layout,
 * just inverted, so it's one component instead of two near-duplicates. */
export function MonoTemplate({ brief, dark }: { brief: PublicBrief; dark: boolean }) {
  const bg = dark ? "#0B0B0C" : "#FFFFFF";
  const ink = dark ? "#FFFFFF" : "#111111";
  const muted = dark ? "rgba(255,255,255,0.55)" : "rgba(17,17,17,0.55)";
  const line = dark ? "rgba(255,255,255,0.18)" : "rgba(17,17,17,0.18)";
  return (
    <div className="min-h-screen" style={{ background: bg, color: ink }}>
      <div className="max-w-xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <div className="flex items-center justify-between pb-6" style={{ borderBottom: `1.5px solid ${ink}` }}>
          <span className="text-sm font-bold tracking-[0.08em] uppercase">Quote</span>
          <span className="text-caption tracking-[0.15em] uppercase" style={{ color: muted }}>
            {brief.client}
          </span>
        </div>

        <h1 className="text-[24px] font-bold m-0 mt-8">{brief.title}</h1>

        <div className="flex flex-wrap gap-4 sm:gap-8 mt-6 pb-6 text-small" style={{ borderBottom: `1px solid ${line}` }}>
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
          <div className="py-6" style={{ borderBottom: `1px solid ${line}` }}>
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">Strategy</div>
            <p className="text-body leading-relaxed m-0">{brief.strategy.goal}</p>
            {brief.strategy.findings.map((f, i) => (
              <p
                key={i}
                className="text-small leading-relaxed m-0 mt-2 pl-4"
                style={{ borderLeft: `1px solid ${line}` }}
              >
                {f}
              </p>
            ))}
          </div>
        )}

        <div className="py-6" style={{ borderBottom: `1px solid ${line}` }}>
          <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">Scope</div>
          <Prose text={brief.scope} className="text-lead leading-[1.7]" />
        </div>

        <div className="py-6" style={{ borderBottom: `1px solid ${line}` }}>
          <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">Deliverables</div>
          <div className="flex flex-col gap-1">
            {brief.deliverables.map((d, i) => {
              const { lead, detail } = splitDeliverable(d);
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-lead shrink-0">-</span>
                  <div className="min-w-0">
                    <div className="text-lead leading-snug">{lead}</div>
                    {detail && (
                      <div className="text-body leading-relaxed mt-1.5" style={{ color: muted }}>
                        {detail}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="py-6" style={{ borderBottom: `1px solid ${line}` }}>
          <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">Timeline</div>
          <TimelineView timeline={brief.timeline} accent={ink} muted={muted} />
        </div>

        {brief.examples.length > 0 && (
          <div className="py-6" style={{ borderBottom: `1px solid ${line}` }}>
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">Examples</div>
            <ExampleGallery examples={brief.examples} />
          </div>
        )}

        {extraBlocks(brief.extras).map(([label, text]) => (
          <div key={label} className="py-6" style={{ borderBottom: `1px solid ${line}` }}>
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{label}</div>
            <p className="text-body leading-relaxed m-0 whitespace-pre-line">{text}</p>
          </div>
        ))}

        <div className="flex justify-between items-center pt-6">
          <span className="text-small" style={{ color: muted }}>
            Total
          </span>
          <span className="text-[22px] font-bold">
            {currencySymbol(brief.currency)}{brief.price.toLocaleString()}
          </span>
        </div>

        {brief.signable && (
          <AcceptBlock
            slug={brief.slug}
            accepted={brief.accepted}
            accent={ink}
            muted={muted}
            dark={dark}
          />
        )}
      </div>
    </div>
  );
}

/** Minimal — plain, high-contrast, no shadows or card chrome; letter-spaced
 * labels and hairline rules do the separating instead of color blocks. */
export function MinimalTemplate({ brief, brand }: { brief: PublicBrief; brand: BrandProps }) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <div className="max-w-xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <div className="flex items-center justify-between pb-6 border-b border-ink">
          {brand.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoDataUrl} alt="" className="h-6" />
          ) : (
            <span className="text-sm font-bold tracking-[0.08em] uppercase">Freely</span>
          )}
          <span className="text-caption tracking-[0.15em] uppercase text-slate">Quote</span>
        </div>

        <h1 className="text-[24px] font-bold m-0 mt-8">{brief.title}</h1>
        <p className="text-small text-slate mt-1">{brief.client}</p>

        <div className="flex flex-wrap gap-4 sm:gap-8 mt-6 pb-6 border-b border-line text-small">
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
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">Strategy</div>
            <p className="text-body leading-relaxed m-0">{brief.strategy.goal}</p>
            {brief.strategy.findings.map((f, i) => (
              <p key={i} className="text-small leading-relaxed m-0 mt-2 pl-4 border-l border-line">
                {f}
              </p>
            ))}
          </div>
        )}

        <div className="py-6 border-b border-line">
          <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">Scope</div>
          <Prose text={brief.scope} className="text-lead leading-[1.7]" />
        </div>

        <div className="py-6 border-b border-line">
          <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">Deliverables</div>
          <div className="flex flex-col gap-1">
            {brief.deliverables.map((d, i) => {
              const { lead, detail } = splitDeliverable(d);
              return (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-lead shrink-0">-</span>
                  <div className="min-w-0">
                    <div className="text-lead leading-snug">{lead}</div>
                    {detail && (
                      <div className="text-body leading-relaxed mt-1.5 text-slate">{detail}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="py-6 border-b border-line">
          <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">Timeline</div>
          <TimelineView timeline={brief.timeline} accent="#181722" />
        </div>

        {brief.examples.length > 0 && (
          <div className="py-6 border-b border-line">
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">Examples</div>
            <ExampleGallery examples={brief.examples} />
          </div>
        )}

        {extraBlocks(brief.extras).map(([label, text]) => (
          <div key={label} className="py-6 border-b border-line">
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{label}</div>
            <p className="text-body leading-relaxed m-0 whitespace-pre-line">{text}</p>
          </div>
        ))}

        <div className="flex justify-between items-center pt-6">
          <span className="text-small text-slate">Total</span>
          <span className="text-[22px] font-bold">{currencySymbol(brief.currency)}{brief.price.toLocaleString()}</span>
        </div>

        {brief.signable && (
          <AcceptBlock slug={brief.slug} accepted={brief.accepted} accent="#181722" />
        )}
      </div>
    </div>
  );
}
