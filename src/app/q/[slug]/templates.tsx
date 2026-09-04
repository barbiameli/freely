import { currencySymbol } from "@/lib/currencies";
import { paragraphs, splitDeliverable } from "@/lib/rich-text";
import {
  describeEffort,
  parseRateUnit,
  unitsFromHours,
  rateSuffix,
} from "@/lib/rate-unit";
import { TimelineView } from "@/components/timeline-view";
import { timelineTotal } from "@/lib/timeline";
import { groupDeliverables, milestoneLines, type QuoteMilestone } from "@/lib/milestone-lines";
import { groupsByMilestone, showsMilestoneSection } from "@/lib/quote-layout";
import type { Locale } from "@/lib/i18n";
import { hasStrategyContent } from "@/lib/strategy";
import { basisDefinition, paymentClause, revisionsClause, type BillingBasis, milestoneDefinition, roundDefinition, type DefinitionOverrides } from "@/lib/quote-definitions";
import type { BriefExtras } from "@/lib/anthropic";
import { AcceptBlock } from "./accept-block";
import { dict, type Dictionary } from "@/lib/i18n";

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
  /** The billing split, when the quote is billed that way. What the client is
   * agreeing to pay and when, so it belongs on the document they sign. */
  milestones?: QuoteMilestone[];
  /** Which layout this quote was written for. See lib/quote-layout. */
  layout?: number;
  /** Whether the stages are payment points, or only the shape of the work. */
  milestonesBillable?: boolean;
  /** Reworded or removed per quote. Resolved below, where the words are. */
  definitions?: DefinitionOverrides;
  /**
   * Whether the total is the price or an estimate of hours to be billed.
   *
   * On the quote because it is the thing a client cannot work out from the
   * numbers. Thirteen hours at 50 tells them nothing about whether they owe
   * 650 or whatever the hours turn out to be. See lib/quote-definitions.
   */
  billing?: string | null;
  price: number;
  hours: number;
  hourlyRate?: number | null;
  /** "HOUR" or "DAY": some freelancers quote in days. */
  rateUnit?: string | null;
  /** The language this quote was written in, which drives the page too. */
  language?: string | null;
  currency?: string | null;
  examples: Example[];
  extras?: BriefExtras | null;
  /** Slug and acceptance state, so a published quote can be signed off. Only
   * offered when the quote carries a Statement of Work. */
  slug: string;
  signable: boolean;
  accepted?: { name: string; at: string } | null;
}

/** One eyebrow style and one accent, so the block looks native in all four. */
const MILESTONE_LABEL = "font-label text-xs text-slate uppercase mb-2";
const MILESTONE_ACCENT = "#343434";

export interface BrandProps {
  primary: string;
  accent: string;
  logoDataUrl?: string | null;
}

/** Turns the optional add-on sections into label/body pairs, so each
 * template can render them in its own style without duplicating the logic
 * that decides which ones are present. */
function extraBlocks(
  brief: PublicBrief,
  q: Dictionary["publicQuote"]
): [string, string][] {
  const extras = brief.extras;
  const blocks: [string, string][] = [];
  if (!extras) return blocks;

  if (extras.paymentTerms) {
    blocks.push([
      q.paymentTerms,
      paymentClause(
        extras.paymentTerms,
        {
          hasMilestones: (brief.milestones?.length ?? 0) > 0,
          milestonesBillable: brief.milestonesBillable !== false,
          definition: milestoneDefinition(brief.definitions ?? {}, q, brief.milestonesBillable !== false),
          basis: basisDefinition(
            brief.definitions ?? {},
            q,
            (brief.billing as BillingBasis) ?? "FIXED_TOTAL"
          ),
          billing: (brief.billing as BillingBasis) ?? "FIXED_TOTAL",
          fixedPrice: brief.rateUnit === "FIXED",
        },
        q
      ),
    ]);
  }
  if (extras.revisions) blocks.push([q.revisions, revisionsClause(extras.revisions, q, roundDefinition(brief.definitions ?? {}, q))]);
  if (extras.availability) blocks.push([q.availability, extras.availability]);
  // Bulleted, because these are lists a client checks line by line rather
  // than prose they read once.
  if (extras.assumptions?.length) {
    blocks.push([q.assumptions, extras.assumptions.map((line) => `- ${line}`).join("\n")]);
  }
  if (extras.scopeChanges?.length) {
    blocks.push([q.scopeChanges, extras.scopeChanges.map((line) => `- ${line}`).join("\n")]);
  }
  if (extras.terms) {
    blocks.push([q.cancellation, extras.terms.cancellation]);
    blocks.push([q.ownership, extras.terms.ownership]);
    blocks.push([q.confidentiality, extras.terms.confidentiality]);
  }
  if (extras.aiUsage) {
    // Two lists rather than a paragraph: a client scanning this wants to see
    // the line between what a machine touches and what it does not.
    if (extras.aiUsage.will.length) {
      blocks.push([q.aiWhereUsed, extras.aiUsage.will.map((t) => `- ${t}`).join("\n")]);
    }
    if (extras.aiUsage.willNot.length) {
      blocks.push([
        q.aiWhereNot,
        extras.aiUsage.willNot.map((t) => `- ${t}`).join("\n"),
      ]);
    }
  }
  return blocks;
}

/**
 * The deliverables, in the order the client reads them, grouped when the quote
 * is billed per milestone.
 *
 * One list of rows rather than four templates each working out the grouping:
 * a header row carries the milestone and what it costs, and the item rows
 * under it are its deliverables. A quote that is not billed this way, or that
 * was written before this layout existed, produces item rows only and renders
 * exactly as it always did.
 *
 * Anything the milestones do not cover comes last under its own header, so a
 * deliverable cannot disappear from the document because the split missed it.
 */
type DeliverableRow =
  | { kind: "group"; name: string; amount: string; note?: string }
  | { kind: "item"; text: string; index: number };

function deliverableRows(brief: PublicBrief): DeliverableRow[] {
  const language = (brief.language ?? "en") as Locale;
  const words = dict(language).quote;
  const groups = groupDeliverables({
    milestones: brief.milestones,
    deliverables: brief.deliverables,
    currency: brief.currency,
    language,
    grouped: groupsByMilestone({ layout: brief.layout }, brief.milestones?.length ?? 0),
    paymentTerms: brief.extras?.paymentTerms,
    words: {
      invoicedAtEnd: words.milestoneInvoicedAtEnd,
      alsoIncluded: words.milestoneAlsoIncluded,
    },
  });

  if (!groups) {
    return brief.deliverables.map((text, index) => ({ kind: "item", text, index }));
  }

  const rows: DeliverableRow[] = [];
  for (const group of groups) {
    rows.push({ kind: "group", name: group.name, amount: group.amount, note: group.note });
    for (const index of group.items) {
      rows.push({ kind: "item", text: brief.deliverables[index], index });
    }
  }
  return rows;
}


/**
 * The stages of the work, as their own section.
 *
 * They used to exist only as headings inside the deliverables list, so a
 * client reading a real quote saw no milestones anywhere and reasonably took
 * the headings for deliverables. A deliverable is something they end up
 * holding; a milestone is a stage, and only sometimes a point where money
 * moves.
 *
 * One component for all four templates: a client comparing two quotes from
 * the same freelancer should find the same facts in the same order whichever
 * layout they were sent.
 */
function MilestonesBlock({
  brief,
  q,
  label,
  accent,
}: {
  brief: PublicBrief;
  q: Dictionary["publicQuote"];
  /** The heading's own classes, so each template keeps its own eyebrow style. */
  label: string;
  accent: string;
}) {
  if (!showsMilestoneSection({ layout: brief.layout }, brief.milestones?.length ?? 0)) return null;

  const lines = milestoneLines({
    milestones: brief.milestones,
    deliverables: brief.deliverables,
    currency: brief.currency,
    language: (brief.language ?? "en") as Locale,
    billable: brief.milestonesBillable !== false,
  });
  if (lines.length === 0) return null;

  return (
    <div className="rounded-lg p-4 bg-paper">
      <div className={label}>{q.milestones}</div>
      <div className="flex flex-col gap-3">
        {lines.map((line, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="font-body font-bold text-body" style={{ color: accent }}>
                {i + 1}. {line.name}
              </span>
              {line.amount && (
                <span className="font-body font-bold text-body text-ink tabular-nums shrink-0">
                  {line.amount}
                </span>
              )}
            </div>
            {line.delivers.length > 0 && (
              <div className="text-body text-slate leading-relaxed mt-0.5">
                {line.delivers.join(", ")}
              </div>
            )}
            {line.gate && (
              <div className="text-caption text-text-muted mt-0.5">
                {q.milestoneCloses.replace("{gate}", line.gate)}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Said once, at the foot, rather than implied by whether numbers are
          present: a client should not have to work out from the absence of an
          amount whether a stage is a payment point. */}
      <p className="text-caption text-text-muted mt-3 mb-0">
        {brief.milestonesBillable !== false ? q.milestonesBillable : q.milestonesShapeOnly}
      </p>
    </div>
  );
}

/**
 * The line that starts a milestone's group of deliverables.
 *
 * Deliberately plain across all four templates: the name, what it costs, and
 * when it is invoiced. A client scanning a quote for "what do I pay and when"
 * should find the same three facts in the same order whichever layout they
 * were sent.
 */
function GroupHeading({
  row,
  color,
}: {
  row: { name: string; amount: string; note?: string };
  color: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 flex-wrap pt-1">
      <div className="font-body font-bold text-body" style={{ color }}>
        {row.name}
      </div>
      <div className="flex items-baseline gap-2 shrink-0">
        {row.note && <span className="text-caption text-slate">{row.note}</span>}
        {row.amount && (
          <span className="font-body font-bold text-body text-ink tabular-nums">{row.amount}</span>
        )}
      </div>
    </div>
  );
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
  const q = dict(brief.language).publicQuote;
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
          <span className="font-label text-xs text-slate uppercase">{q.quote}</span>
        </div>
        <div className="p-5 sm:p-9 flex flex-col gap-4">
          <div>
            <h1 className="font-display italic text-3xl m-0" style={{ color: brand.primary }}>
              {brief.title}
            </h1>
            <p className="text-slate text-sm mt-1.5">{brief.client}</p>
          </div>

          {hasStrategyContent(brief.strategy) && (
            <div className="rounded-lg p-4" style={{ background: "rgba(99,32,238,0.07)" }}>
              <div className="font-label text-xs text-slate uppercase mb-2">{q.strategy}</div>
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
            <div className="font-label text-xs text-slate uppercase mb-2">{q.scope}</div>
            <Prose text={brief.scope} className="text-lead text-ink leading-[1.7]" />
          </div>

          <div className="rounded-lg p-4" style={{ background: "rgba(244,91,105,0.08)" }}>
            <div className="font-label text-xs text-slate uppercase mb-2">{q.deliverables}</div>
            <div className="flex flex-col gap-1.5">
              {deliverableRows(brief).map((row, i) => {
                if (row.kind === "group") {
                  return <GroupHeading key={`g${i}`} row={row} color={brand.primary} />;
                }
                const { lead, detail } = splitDeliverable(row.text);
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

          <MilestonesBlock brief={brief} q={q} label={MILESTONE_LABEL} accent={MILESTONE_ACCENT} />

        {brief.timeline && (
            <div className="rounded-lg p-4 bg-paper">
              <div className="font-label text-xs text-slate uppercase mb-2">{q.timeline}</div>
              <TimelineView timeline={brief.timeline} accent={brand.accent} className="text-ink" total={timelineTotal(brief.timeline, q)} />
            </div>
          )}

          {brief.examples.length > 0 && (
            <div>
              <div className="font-label text-xs text-slate uppercase mb-2">{q.examples}</div>
              <ExampleGallery examples={brief.examples} />
            </div>
          )}

          {extraBlocks(brief, q).map(([label, text]) => (
            <div key={label} className="rounded-lg p-4 bg-paper">
              <div className="font-label text-xs text-slate uppercase mb-2">{label}</div>
              <p className="text-body text-ink m-0 leading-relaxed whitespace-pre-line">{text}</p>
            </div>
          ))}

          <div className="rounded-lg p-4 bg-ink flex justify-between items-center">
            <span className="text-body text-white/70">
              {describeEffort(brief.hours, parseRateUnit(brief.rateUnit), q)}
              {brief.hourlyRate
                ? ` · ${currencySymbol(brief.currency)}${brief.hourlyRate}${rateSuffix(
                    parseRateUnit(brief.rateUnit),
                    q
                  )}`
                : ""}
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
  const q = dict(brief.language).publicQuote;
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
          <span className="text-caption tracking-[0.15em] uppercase text-slate">{q.quotation}</span>
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
            <div className="text-caption uppercase tracking-[0.08em] text-slate mt-1">{q.total}</div>
          </div>
          <div>
            <div className="font-body font-bold text-[26px] text-ink">
              {unitsFromHours(brief.hours, parseRateUnit(brief.rateUnit))}
              {parseRateUnit(brief.rateUnit) === "DAY" ? "d" : "h"}
            </div>
            <div className="text-caption uppercase tracking-[0.08em] text-slate mt-1">
              {parseRateUnit(brief.rateUnit) === "DAY" ? q.estimatedDays : q.estimatedHours}
            </div>
          </div>
          {brief.hourlyRate && (
            <div>
              <div className="font-body font-bold text-[26px] text-ink">{currencySymbol(brief.currency)}{brief.hourlyRate}</div>
              <div className="text-caption uppercase tracking-[0.08em] text-slate mt-1">
              {parseRateUnit(brief.rateUnit) === "DAY" ? q.perDay : q.perHour}
            </div>
            </div>
          )}
        </div>

        {hasStrategyContent(brief.strategy) && (
          <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
            <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
              {q.strategy}
            </h2>
            <p className="text-lead leading-relaxed text-ink">{brief.strategy.goal}</p>
            {brief.strategy.findings.length > 0 && (
              <div className="mt-5">
                <div className="text-caption uppercase tracking-[0.1em] text-slate mb-2">{q.findings}</div>
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
            {q.scope}
          </h2>
          <Prose text={brief.scope} className="text-lead leading-[1.7] text-ink" />
        </div>

        <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
          <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
            {q.deliverables}
          </h2>
          <div className="flex flex-col gap-2.5">
            {deliverableRows(brief).map((row, i) => {
              if (row.kind === "group") {
                return <GroupHeading key={`g${i}`} row={row} color={brand.primary} />;
              }
              const { lead, detail } = splitDeliverable(row.text);
              return (
                <div key={i} className="flex items-baseline gap-3">
                  <span className="text-caption tabular-nums text-slate w-5 shrink-0">
                    {String(row.index + 1).padStart(2, "0")}
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

        <MilestonesBlock brief={brief} q={q} label={MILESTONE_LABEL} accent={MILESTONE_ACCENT} />

        {brief.timeline && (
          <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
            <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
              {q.timeline}
            </h2>
            <TimelineView timeline={brief.timeline} accent={brand.primary} className="text-ink" total={timelineTotal(brief.timeline, q)} />
          </div>
        )}

        {brief.examples.length > 0 && (
          <div className="py-10 border-b" style={{ borderColor: "#E8EAEF" }}>
            <h2 className="font-display italic text-2xl m-0 mb-4" style={{ color: brand.primary }}>
              {q.examples}
            </h2>
            <ExampleGallery examples={brief.examples} />
          </div>
        )}

        {extraBlocks(brief, q).map(([label, text]) => (
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
  const q = dict(brief.language).publicQuote;
  const bg = dark ? "#0B0B0C" : "#FFFFFF";
  const ink = dark ? "#FFFFFF" : "#111111";
  const muted = dark ? "rgba(255,255,255,0.55)" : "rgba(17,17,17,0.55)";
  const line = dark ? "rgba(255,255,255,0.18)" : "rgba(17,17,17,0.18)";
  return (
    <div className="min-h-screen" style={{ background: bg, color: ink }}>
      <div className="max-w-xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <div className="flex items-center justify-between pb-6" style={{ borderBottom: `1.5px solid ${ink}` }}>
          <span className="text-sm font-bold tracking-[0.08em] uppercase">{q.quote}</span>
          <span className="text-caption tracking-[0.15em] uppercase" style={{ color: muted }}>
            {brief.client}
          </span>
        </div>

        <h1 className="text-[24px] font-bold m-0 mt-8">{brief.title}</h1>

        <div className="flex flex-wrap gap-4 sm:gap-8 mt-6 pb-6 text-small" style={{ borderBottom: `1px solid ${line}` }}>
          <span>
            <strong>{currencySymbol(brief.currency)}{brief.price.toLocaleString()}</strong> {q.totalLower}
          </span>
          <span>
            <strong>{brief.hours}h</strong> {q.estimatedLower}
          </span>
          {brief.hourlyRate && (
            <span>
              <strong>{currencySymbol(brief.currency)}{brief.hourlyRate}</strong>/hr
            </span>
          )}
        </div>

        {hasStrategyContent(brief.strategy) && (
          <div className="py-6" style={{ borderBottom: `1px solid ${line}` }}>
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{q.strategy}</div>
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
          <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{q.scope}</div>
          <Prose text={brief.scope} className="text-lead leading-[1.7]" />
        </div>

        <div className="py-6" style={{ borderBottom: `1px solid ${line}` }}>
          <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{q.deliverables}</div>
          <div className="flex flex-col gap-1">
            {deliverableRows(brief).map((row, i) => {
              if (row.kind === "group") {
                return <GroupHeading key={`g${i}`} row={row} color={ink} />;
              }
              const { lead, detail } = splitDeliverable(row.text);
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

        <MilestonesBlock brief={brief} q={q} label={MILESTONE_LABEL} accent={MILESTONE_ACCENT} />

        {brief.timeline && (
          <div className="py-6" style={{ borderBottom: `1px solid ${line}` }}>
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{q.timeline}</div>
            <TimelineView timeline={brief.timeline} accent={ink} muted={muted} total={timelineTotal(brief.timeline, q)} />
          </div>
        )}

        {brief.examples.length > 0 && (
          <div className="py-6" style={{ borderBottom: `1px solid ${line}` }}>
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{q.examples}</div>
            <ExampleGallery examples={brief.examples} />
          </div>
        )}

        {extraBlocks(brief, q).map(([label, text]) => (
          <div key={label} className="py-6" style={{ borderBottom: `1px solid ${line}` }}>
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{label}</div>
            <p className="text-body leading-relaxed m-0 whitespace-pre-line">{text}</p>
          </div>
        ))}

        <div className="flex justify-between items-center pt-6">
          <span className="text-small" style={{ color: muted }}>
            {q.total}
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
  const q = dict(brief.language).publicQuote;
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
          <span className="text-caption tracking-[0.15em] uppercase text-slate">{q.quote}</span>
        </div>

        <h1 className="text-[24px] font-bold m-0 mt-8">{brief.title}</h1>
        <p className="text-small text-slate mt-1">{brief.client}</p>

        <div className="flex flex-wrap gap-4 sm:gap-8 mt-6 pb-6 border-b border-line text-small">
          <span>
            <strong>{currencySymbol(brief.currency)}{brief.price.toLocaleString()}</strong> {q.totalLower}
          </span>
          <span>
            <strong>{brief.hours}h</strong> {q.estimatedLower}
          </span>
          {brief.hourlyRate && (
            <span>
              <strong>{currencySymbol(brief.currency)}{brief.hourlyRate}</strong>/hr
            </span>
          )}
        </div>

        {hasStrategyContent(brief.strategy) && (
          <div className="py-6 border-b border-line">
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{q.strategy}</div>
            <p className="text-body leading-relaxed m-0">{brief.strategy.goal}</p>
            {brief.strategy.findings.map((f, i) => (
              <p key={i} className="text-small leading-relaxed m-0 mt-2 pl-4 border-l border-line">
                {f}
              </p>
            ))}
          </div>
        )}

        <div className="py-6 border-b border-line">
          <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{q.scope}</div>
          <Prose text={brief.scope} className="text-lead leading-[1.7]" />
        </div>

        <div className="py-6 border-b border-line">
          <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{q.deliverables}</div>
          <div className="flex flex-col gap-1">
            {deliverableRows(brief).map((row, i) => {
              if (row.kind === "group") {
                return <GroupHeading key={`g${i}`} row={row} color={"#181722"} />;
              }
              const { lead, detail } = splitDeliverable(row.text);
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

        <MilestonesBlock brief={brief} q={q} label={MILESTONE_LABEL} accent={MILESTONE_ACCENT} />

        {brief.timeline && (
          <div className="py-6 border-b border-line">
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{q.timeline}</div>
            <TimelineView timeline={brief.timeline} accent="#181722" total={timelineTotal(brief.timeline, q)} />
          </div>
        )}

        {brief.examples.length > 0 && (
          <div className="py-6 border-b border-line">
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{q.examples}</div>
            <ExampleGallery examples={brief.examples} />
          </div>
        )}

        {extraBlocks(brief, q).map(([label, text]) => (
          <div key={label} className="py-6 border-b border-line">
            <div className="text-caption font-bold tracking-[0.1em] uppercase mb-2">{label}</div>
            <p className="text-body leading-relaxed m-0 whitespace-pre-line">{text}</p>
          </div>
        ))}

        <div className="flex justify-between items-center pt-6">
          <span className="text-small text-slate">{q.total}</span>
          <span className="text-[22px] font-bold">{currencySymbol(brief.currency)}{brief.price.toLocaleString()}</span>
        </div>

        {brief.signable && (
          <AcceptBlock slug={brief.slug} accepted={brief.accepted} accent="#181722" />
        )}
      </div>
    </div>
  );
}
