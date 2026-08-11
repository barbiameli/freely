import type { BillingMode } from "@/lib/invoice-queue";

/**
 * Works out whether a project bills per milestone, from what the quote says.
 *
 * This used to be a pair of chips on the project. Asking was the safe choice
 * and the wrong one: the answer is already written down in the quote the client
 * agreed to, so asking again is asking someone to retype what they decided
 * weeks ago, and a project sitting on the wrong default bills wrongly and
 * quietly.
 *
 * The signals, in the order they are trusted:
 *
 * 1. The payment terms the quote went out with. "40% up front, the rest at each
 *    milestone" is the freelancer's own sentence about how this bills.
 * 2. The instructions given when the quote was generated, which is where the
 *    "split it into milestones with a payment at each" preset lands.
 *
 * The timeline is deliberately not a signal. Every project has stages; stages
 * are how work is organised, not how it is billed, and treating "Week 1-2,
 * Week 3-4" as milestone billing would put nearly everything in the wrong mode.
 *
 * Both languages, because the quote is written in whichever the client reads.
 * Accents are stripped before matching. No pattern below needs that today,
 * since none of the matched phrases carry an accent, but it stops the next one
 * that does from silently never matching.
 */
const MILESTONE_PATTERNS = [
  // English
  /\bmilestones?\b/,
  /\bstage payments?\b/,
  /\bin (?:two|three|four|2|3|4) payments\b/,
  /\bon completion of each\b/,
  /\bafter each (?:phase|stage|deliverable)\b/,
  /\bphased (?:billing|invoicing|payments?)\b/,
  // Spanish
  /\bhitos?\b/,
  /\bpor fases\b/,
  /\bpagos? por (?:fase|entrega|entregable)\b/,
  /\ba la entrega de cada\b/,
  /\ben (?:dos|tres|cuatro|2|3|4) pagos\b/,
];

/** Lowercased, accents removed, so one pattern covers both spellings. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export interface BillingSignals {
  /** The quote's payment terms, as they went to the client. */
  paymentTerms?: string | null;
  /** What the freelancer asked for when generating the quote. */
  instructions?: string | null;
}

export interface BillingDetection {
  mode: BillingMode;
  /** Which text decided it, for showing where the answer came from. */
  from: "paymentTerms" | "instructions" | null;
}

export function detectBillingMode(signals: BillingSignals): BillingDetection {
  const sources: [BillingDetection["from"], string | null | undefined][] = [
    ["paymentTerms", signals.paymentTerms],
    ["instructions", signals.instructions],
  ];

  for (const [from, text] of sources) {
    if (!text) continue;
    const haystack = normalise(text);
    if (MILESTONE_PATTERNS.some((pattern) => pattern.test(haystack))) {
      return { mode: "PER_MILESTONE", from };
    }
  }

  return { mode: "ON_COMPLETION", from: null };
}

export interface MilestoneProgress {
  /** Which milestone the work is on, 1-based. Equals total once all are done. */
  current: number;
  total: number;
}

/**
 * Which milestone a project is on.
 *
 * "Milestone 3/5" means two are finished and the third is the one in hand,
 * which is what someone wants to know mid-project. Once everything is done it
 * reads 5/5 rather than 6/5.
 */
export function milestoneProgress(deliverables: { done: boolean }[]): MilestoneProgress {
  const total = deliverables.length;
  if (total === 0) return { current: 0, total: 0 };
  const done = deliverables.filter((d) => d.done).length;
  return { current: Math.min(done + 1, total), total };
}
