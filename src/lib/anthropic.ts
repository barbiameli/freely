import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { scanBrandGuide, scanIsComplete } from "@/lib/brand-scan";
import { currencySymbol } from "@/lib/currencies";
import { countryName } from "@/lib/countries";
import { parseLevels, type RateLevels } from "@/lib/market-rate";
import type { SectionNotes } from "@/lib/quote-prompts";
import type { Locale } from "@/lib/i18n/types";
import { dict } from "@/lib/i18n";
import { sanitizeText } from "@/lib/sanitize-text";
import { keepOnly, keyFor, scopeOf, type RefineScope } from "@/lib/refine-scope";
import { buildPlanPrompt, planSchema, type QuotePlan } from "@/lib/quote-plan";
import {
  benchmarkSchema,
  buildBenchmarkPrompt,
  type BenchmarkFacts,
  type BenchmarkKey,
} from "@/lib/benchmarks";
import {
  buildSuggestPrompt,
  suggestionResponseSchema,
  type SuggestionResponse,
} from "@/lib/suggest-sections";
import {
  priceFor,
  rateSuffix,
  unitNoun,
  HOURS_PER_DAY,
  type RateUnit,
} from "@/lib/rate-unit";

/**
 * Two models, chosen per job rather than one for everything.
 *
 * The split is not about importance, it is about what the task is. Writing a
 * whole quote, rewriting a section for a client, or turning a deliverable into
 * steps and risks are judgement. Pulling a hex code out of a document, or
 * saying the same sentence more plainly, is not: a smaller model does those as
 * well and costs roughly a tenth as much, and running everything on the larger
 * one was paying judgement prices for transcription.
 */
const MODEL = "claude-sonnet-4-6";

/** Extraction, and short rewrites of somebody else's words. */
const SMALL_MODEL = "claude-haiku-4-5-20251001";

/** USD per million tokens, list price. For the cost estimate logged on every
 * call — not for billing, so it doesn't need cache-token nuance. */
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  [MODEL]: { input: 3.0, output: 15.0 },
  [SMALL_MODEL]: { input: 1.0, output: 5.0 },
};

let client: Anthropic | null = null;

/** Lazily constructs the Anthropic client so importing this module never
 * requires the API key to be present (useful in tests). */
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to your .env file, see .env.example."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** Structured "Strategy" section — goal statement, findings/assumptions, an
 * explicit AI will/won't delineation, and open questions. Kept as discrete
 * fields (not one prose blob) so every renderer (brief view, PDF, public
 * page) can lay it out as real headed sections with bullets, not a wall of
 * text with numbers embedded in the sentence. */
export const strategySchema = z.object({
  // Both empty is a valid quote, not a failed one. The object is asked for on
  // every quote because openQuestions are notes to the freelancer, and a quote
  // with the Approach section switched off has no goal or findings to write.
  // Requiring them here rejected the whole response over the half nobody
  // asked for.
  goal: z.string().default(""),
  findings: z.array(z.string()).default([]),
  // Kept for backward compatibility with briefs generated before AI-use
  // disclosure was split out as its own standalone toggle — no longer asked
  // for or rendered anywhere, so these will simply be empty on new briefs.
  aiWill: z.array(z.string()).default([]),
  aiWillNot: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
});
export type Strategy = z.infer<typeof strategySchema>;

/** The optional add-on sections, grouped so they can be stored in one JSON
 * column rather than needing a migration each time we add another. */
export const briefExtrasSchema = z.object({
  terms: z
    .object({
      cancellation: z.string(),
      ownership: z.string(),
      confidentiality: z.string(),
    })
    .optional(),
  revisions: z.string().optional(),
  availability: z.string().optional(),
  /**
   * What this quote takes as given.
   *
   * The mechanism that turns an underestimate from a mistake into a changed
   * circumstance. A price with no stated assumptions is a promise about a
   * project nobody has seen yet; the same price with "12 screens, one user
   * role, copy supplied by you" attached is a conditional commitment, and when
   * the twelve screens turn out to be twenty there is a document to point at
   * rather than an argument to have.
   */
  assumptions: z.array(z.string()).optional(),
  /**
   * What would change the price, named in advance.
   *
   * Read as adversarial only when it arrives after the fact. Sent with the
   * quote it reads as somebody who has done this before, and it is the
   * difference between a conversation and an invoice nobody expected.
   */
  scopeChanges: z.array(z.string()).optional(),
  /** When money is due. Never contains bank details: those belong on an
   * invoice, not on a quote that may be published to a public URL. */
  paymentTerms: z.string().optional(),
  /**
   * How AI will and will not be used on this specific project.
   *
   * Not a generic "AI helped write this" line. A client wants to know which
   * parts of the work a machine touches: the mechanical and repetitive parts
   * it is good at, and the judgement calls it is kept away from.
   */
  aiUsage: z
    .object({
      will: z.array(z.string()),
      willNot: z.array(z.string()),
    })
    .optional(),
});
export type BriefExtras = z.infer<typeof briefExtrasSchema>;

/**
 * How the work splits into billable chunks.
 *
 * A milestone groups deliverables; it is not one deliverable renamed. The
 * client agrees to this split when they agree to the quote, which is why it is
 * generated here rather than assembled later in the tracker.
 */
export const milestoneSchema = z.object({
  name: z.string().min(1),
  /** Positions in the deliverables array, 0-based. */
  deliverableIndexes: z.array(z.number().int().nonnegative()),
  /**
   * What has to happen for this milestone to be finished, beyond the
   * deliverables in it.
   *
   * Usually an agreement rather than an artifact: a direction signed off, a
   * stakeholder review, a decision made. This is what actually makes a
   * milestone a milestone. Three deliverables that could all have been done in
   * any order is a batch; a batch that ends in "and then we agree the
   * direction" is a milestone, because the next one cannot start without it.
   *
   * It also tells the client what they have to do, which is the part of a
   * schedule freelancers most often fail to make explicit and then get delayed
   * by.
   */
  gate: z.string().optional(),
  amount: z.number().nonnegative(),
});
export type GeneratedMilestoneShape = z.infer<typeof milestoneSchema>;

/**
 * What a generated quote has to contain.
 *
 * The text fields accept an empty string. They used to require at least one
 * character, and a brief that never named the client came back with client: ""
 * and the entire quote was discarded: scope, deliverables, pricing, timeline,
 * a minute of waiting and a paid model call, thrown away over one word the
 * freelancer could have typed in two seconds.
 *
 * A missing word is not a broken quote. Empty strings are filled in afterwards
 * with something obviously provisional, which the freelancer edits like any
 * other part of the draft. See fillGaps.
 *
 * Deliverables stay required. A quote with nothing in it is not a quote, and
 * there is nothing sensible to invent in its place.
 */
export const briefSchema = z.object({
  title: z.string(),
  client: z.string(),
  scope: z.string(),
  deliverables: z.array(z.string()).min(1),
  timeline: z.string(),
  /** Optional structured "Strategy" section. Only populated when the
   * wizard's "Strategy" section is included. */
  strategy: strategySchema.optional(),
  /**
   * Which of the freelancer's disciplines this job mostly is.
   *
   * Only asked for when they do more than one. Optional and unvalidated
   * against the list here on purpose: a key the app does not recognise is
   * dropped where it is read, which is better than failing a whole quote over
   * one word.
   */
  discipline: z.string().optional(),
  price: z.number().nonnegative(),
  hours: z.number().nonnegative(),
  /** Only present when the quote is being billed in milestones. */
  milestones: z.array(milestoneSchema).optional(),
  terms: briefExtrasSchema.shape.terms,
  revisions: briefExtrasSchema.shape.revisions,
  availability: briefExtrasSchema.shape.availability,
  assumptions: briefExtrasSchema.shape.assumptions,
  scopeChanges: briefExtrasSchema.shape.scopeChanges,
  paymentTerms: briefExtrasSchema.shape.paymentTerms,
  aiUsage: briefExtrasSchema.shape.aiUsage,
});

export type GeneratedBrief = z.infer<typeof briefSchema>;

/** A past quoted (and ideally tracked/accepted) project, used to anchor
 * pricing and hour estimates for a new quote. */
export interface PricingHistoryEntry {
  /**
   * Which discipline that quote was for, where it is known.
   *
   * Blended history is how a design sprint gets anchored against a build. The
   * model names the discipline of the job in front of it and can see which of
   * these match, so the weighting happens where the judgment is rather than in
   * a filter here that would throw away context when there are only two.
   */
  discipline?: string;
  title: string;
  price: number;
  hours: number;
  impliedHourlyRate: number;
  /**
   * Whether the client said yes.
   *
   * The difference between a price that worked and one that did not, which is
   * the only thing that makes a pricing history more useful than an average.
   * Optional so older callers and tests still compile; treated as undecided.
   */
  outcome?: "PENDING" | "WON" | "LOST";
}

export interface QuoteDraftInput {
  sourceText: string;
  instructions: string;
  memoryProjectTitles: string[];
  format: "HTML" | "PDF" | "Figma";
  includeSOW: boolean;
  includeAI: boolean;
  /** Includable "Strategy" section — audit findings, approach, AI will/won't,
   * open questions. */
  includeStrategy: boolean;
  /** Whether Timeline should be broken out as its own explicit, staged
   * section (it's always present on a brief, but this controls how much
   * weight/detail it gets, matching the wizard's Include toggles). */
  includeTimeline: boolean;
  /** This freelancer's rate for this kind of work. Optional: 0 means they
   * did not give one, in which case a location is required instead and the
   * rate comes from market research. When it is given it is authoritative,
   * and the generated price is forced to match it. */
  hourlyRate: number;
  /** Whether the rate above is per hour or per day. */
  rateUnit?: RateUnit;
  /**
   * What this person does, for the model to pick from.
   *
   * Only sent when there is more than one, because with one there is nothing to
   * decide and asking would invite the model to disagree with a fact.
   */
  disciplines?: { key: string; label: string }[];
  /**
   * Which of those the freelancer said this quote is.
   *
   * Chosen in the rate row, because the rate is per discipline and the two
   * cannot be allowed to drift apart. Sent so the model writes the quote as
   * that kind of work rather than inferring it a second time and disagreeing
   * with the number it was given.
   */
  discipline?: string;
  /**
   * Whether the total is the price or an estimate of hours to be billed.
   *
   * Changes what the payment terms have to say, so the model is told rather
   * than left to phrase it from the numbers.
   */
  billing?: "FIXED_TOTAL" | "HOURLY_TRACKED";
  /**
   * The ground rules this account keeps. See lib/ground-rules.
   *
   * Sent so the quote is written to satisfy them rather than written first and
   * marked against them afterwards. A flag that could have been avoided by
   * saying so up front is a flag that should not have existed.
   */
  activeRules?: string[];
  /**
   * How well the freelancer knows this client. See lib/protection.
   *
   * Stored on the quote as well as sent, because it is the answer to "why does
   * this quote carry all this" and a quote reopened in a month should still
   * be able to say.
   */
  protection?: "KNOWN" | "NEW" | "GUARDED";
  /**
   * The client's name, as the freelancer typed it.
   *
   * Carried so the client record is matched on what they wrote rather than on
   * whatever the model put in the quote, which differ often enough to make
   * duplicates.
   */
  clientName?: string;
  /**
   * Whether the stages are payment points, or only the shape of the work.
   *
   * Two questions that used to be one. A project can run in stages and still
   * be paid in two lumps at either end, and putting an amount on every stage
   * of one of those invents a schedule nobody agreed to.
   */
  milestonesBillable?: boolean;
  /**
   * The figures those rules state. See lib/ground-rules.
   *
   * Sent so the quote says "due within 14 days" rather than a term the model
   * invented, which is the difference between a rule and a preference.
   */
  ruleValues?: Partial<Record<string, number>>;
  /**
   * Which way this freelancer's estimates habitually miss.
   *
   * Only present at the LEARN mode and above, and only ever a correction to
   * apply rather than a number to copy. See lib/time-tracking.
   */
  estimateHabit?: string;
  /**
   * Nobody picked any sections, so the model picks them.
   *
   * Set by the action when every include flag is false, which is now what a
   * first quote looks like. The alternative was a bare scope-and-price quote
   * for anyone who did not go through the list, and a freelancer who has not
   * yet decided what their quotes carry is exactly the one with least reason
   * to be handed the barest possible document.
   *
   * It stays a decision the model makes once, at generation: what came back
   * is written into settings, so the quote's sections are as fixed afterwards
   * as if they had been ticked by hand.
   */
  chooseSections?: boolean;
  /** The language the quote is written in. Not necessarily the language the
   * freelancer works in: a Spanish designer often has English clients. */
  language?: Locale;
  /** What the freelancer said about the optional sections that rest on a
   * decision only they can make. Blank means it is written from the brief
   * instead. */
  sectionNotes?: SectionNotes;
  /** Self-reported seniority, only really load-bearing when there's no
   * pricing history to anchor to and Claude has to research market rates. */
  expertiseLevel: "Junior" | "Mid-level" | "Senior" | "Expert";
  /** Which of the 3 public-quote-page visual templates this brief should
   * render with — purely a presentation choice, doesn't affect generation. */
  template?: "classic" | "editorial" | "minimal";
  /** Which color/logo treatment to render with — see lib/branding.ts. Also
   * purely a presentation choice, doesn't affect generation. */
  branding?: "freely" | "own" | "mono-light" | "mono-dark";
  /**
   * When the money arrives.
   *
   * One question with three answers, replacing four places that each asked
   * part of it: the rate card, a milestone toggle, a "how do you want to be
   * paid?" question on the Statement of Work section, and a "price this fixed"
   * preset in the project notes. Asking the same thing four ways produced
   * quotes whose payment terms disagreed with their own milestones.
   *
   * MILESTONE is what creates milestones. There is no separate toggle for
   * them: choosing to be paid per milestone is choosing to have milestones,
   * and a project can no longer be billed per milestone without having any.
   */
  paymentPlan?: "UPFRONT" | "SPLIT" | "ON_DELIVERY" | "MILESTONE";
  /** For SPLIT: how much is due before the work starts. */
  upfrontPercent?: number;
  /**
   * How many milestones the freelancer wants.
   *
   * Undefined means they have not said, and the model decides from the shape
   * of the work, which is usually the better answer: the natural number of
   * chunks is a property of the project, not a preference.
   */
  milestoneCount?: number;
  /**
   * What the freelancer said should go in which milestone.
   *
   * Free text, because this is a sentence people already know how to say
   * ("research and audit first, then all the design, then build") and a
   * structured picker would be slower than typing it.
   */
  milestoneNotes?: string;
  /** Cancellation, ownership and confidentiality terms. */
  includeTerms?: boolean;
  /** How many revision rounds are included. */
  includeRevisions?: boolean;
  /** Capacity, start date and response times. */
  includeAvailability?: boolean;
  /** What the quote takes as given. See briefExtrasSchema. */
  includeAssumptions?: boolean;
  /** What would change the price. See briefExtrasSchema. */
  includeScopeChanges?: boolean;
  /** What the freelancer actually said about their availability, from the
   * wizard. Without this the Availability section is invented, so when it is
   * empty the section is skipped rather than guessed at. */
  availability?: { facts: string[] };
  /** ISO 4217 code (e.g. "USD", "EUR") — defaults from the user's saved
   * preference. Purely a display choice; the underlying number is the same
   * regardless of currency. */
  currency?: string;
  /**
   * Extra context for pricing, asked for when there's no quote history to
   * anchor to. Location does most of the work here: rates for the same job
   * differ by multiples between markets, and previously the model was left
   * to infer a market from the brief, which is a guess.
   */
  pricing?: PricingContext;
  /**
   * Explicit opt-in to live web research for market rates. Defaults to
   * false/undefined: research adds real latency to the slowest, most-used
   * LLM call, so it no longer turns on just because there's no history or no
   * rate — the freelancer has to ask for it. See "Gate web_search out of the
   * default quote-generation path".
   */
  researchMarketRates?: boolean;
}

export interface PricingContext {
  /** Where the freelancer is based, e.g. "Valencia, Spain". */
  yourLocation?: string;
  /** Where the client is. Often the stronger signal: a London client pays
   * London rates whoever they hire. */
  clientLocation?: string;
  /** Startup, agency, enterprise, non-profit, individual. Moves budgets a lot. */
  clientType?: string;
  /** Anything the client said about budget, even a vague range. */
  budgetHint?: string;
  /** Whether this is a rush job, which usually carries a premium. */
  urgency?: string;
  /** Whether they have done this kind of work before, even unpaid. */
  experienceNote?: string;
}

export interface MemoryContext {
  instructions: string;
  /**
   * What this person does, main discipline first.
   *
   * A quote for a job that is half design and half front end reads differently
   * when the model knows the same person is doing both: one scope, one price,
   * one timeline, rather than a design quote that treats the build as somebody
   * else's problem.
   */
  disciplines?: string;
  toneNotes?: string;
  storyNotes?: string;
  contextNotes?: string;
  /** Extracted text of any Files the user has saved in Memory. */
  fileExcerpts?: { name: string; text: string }[];
}

/** Builds the system prompt injected into every generation/refine call —
 * this is where everything saved in Memory (Instructions, Tone, Story,
 * Context, Files) gets applied. */
export function buildSystemPrompt(memory: MemoryContext | string): string {
  const ctx: MemoryContext =
    typeof memory === "string" ? { instructions: memory } : memory;

  const sections: (string | null)[] = [
    "You are the quoting assistant inside Freely, an all-in-one platform for freelancers. You write client-facing quotes with the specificity, judgment, and confident tone of an experienced independent consultant who has sent hundreds of proposals, not generic boilerplate. Avoid vague filler like \"we will collaborate closely\" or \"ensure a high-quality outcome\"; instead, name the actual steps, artifacts, and decisions involved, grounded in the source material you're given.",
    "Never use em dashes or en dashes anywhere in your output. Use a comma, a full stop, or a hyphen instead. This applies to every field, including scope, deliverables, timeline and terms.",
    "Never end a sentence by contrasting it with what you are not saying. Do not write 'X, not Y', 'rather than Y', or 'not just X'. Say the thing and stop: 'best used as visual reference only' rather than adding 'not as a foundation to build on'. The client did not propose the alternative, so arguing against it reads as defensive. The exception is payment terms, cancellation terms and the revisions policy, where a real distinction is sometimes the substance of the clause.",
    "Every number you write, hours, price, timeline, should be defensible. Reason from the stated hourly rate and any pricing history provided, not from round numbers that merely sound reasonable.",
    ctx.disciplines?.trim() || null,
    ctx.instructions?.trim() || null,
    ctx.toneNotes?.trim() ? `Tone notes: ${ctx.toneNotes.trim()}` : null,
    ctx.storyNotes?.trim() ? `Studio story / background: ${ctx.storyNotes.trim()}` : null,
    ctx.contextNotes?.trim() ? `Additional context: ${ctx.contextNotes.trim()}` : null,
    ctx.fileExcerpts?.length
      ? `Reference material from saved files:\n${ctx.fileExcerpts
          .map((f) => `--- ${f.name} ---\n${f.text.slice(0, 4000)}`)
          .join("\n\n")}`
      : null,
    'Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this schema: {"title": string, "client": string, "scope": string, "deliverables": string[], "timeline": string, "discipline": string (only when you were given a list of kinds of work to choose from; one of those keys), "strategy": {"goal": string, "findings": string[], "openQuestions": string[]} (always include this object; when Strategy was not requested, goal is "" and findings is []), "price": number, "hours": number, "terms": {"cancellation": string, "ownership": string, "confidentiality": string} (optional), "revisions": string (optional), "availability": string (optional), "assumptions": string[] (optional), "scopeChanges": string[] (optional), "paymentTerms": string (optional), "aiUsage": {"will": string[], "willNot": string[]} (optional)}. Omit any optional key entirely unless it was explicitly requested. "client" is the name of the person or company being quoted. Plenty of briefs never name one: when the brief does not say, put a short generic stand-in like "Client" rather than an empty string, and never invent a company name. The same goes for "title": describe the work in a few words if the brief does not title it. Never put bank account numbers, sort codes, IBANs, card details or any other payment credentials anywhere in the response, not even as an example or placeholder: quotes can be published to a public web address, so payment details belong only on an invoice. Each findings/openQuestions entry should be one short, standalone bullet point, not a run-on sentence with several ideas mashed together, and never numbered manually (e.g. no "(1)" prefixes) since the UI renders them as a real bulleted list. If you used web search to research rates, do not include citations or URLs in the JSON, fold the conclusion into your reasoning about price only.',
  ];

  return sections.filter(Boolean).join(" ");
}

/** Folds whatever pricing context was given into the prompt. Only the parts
 * actually filled in are mentioned, so an empty answer never becomes a
 * confident-looking blank. */
function formatPricingContext(pricing?: PricingContext): string {
  if (!pricing) return "";
  const lines: string[] = [];
  if (pricing.yourLocation?.trim()) lines.push(`- The freelancer is based in ${pricing.yourLocation.trim()}.`);
  if (pricing.clientLocation?.trim()) lines.push(`- The client is in ${pricing.clientLocation.trim()}.`);
  if (pricing.clientType?.trim()) lines.push(`- The client is a ${pricing.clientType.trim()}.`);
  if (pricing.budgetHint?.trim()) lines.push(`- Budget signal from the client: ${pricing.budgetHint.trim()}.`);
  if (pricing.urgency?.trim()) lines.push(`- Timing: ${pricing.urgency.trim()}.`);
  if (pricing.experienceNote?.trim())
    lines.push(`- Their experience with this kind of work: ${pricing.experienceNote.trim()}.`);
  if (!lines.length) return "";
  return `\nContext for the research:\n${lines.join("\n")}`;
}

/**
 * Past quotes for the prompt, marked with whether they were won.
 *
 * The outcome is the point. Without it the model is averaging every number
 * this freelancer has ever typed, including the ones that lost the job, and
 * quietly reproducing the prices that did not work.
 */
function formatPricingHistory(history: PricingHistoryEntry[], symbol: string): string {
  if (!history.length) return "";
  const label = (outcome?: string) =>
    outcome === "WON" ? " [WON]" : outcome === "LOST" ? " [turned down]" : "";
  const rows = history
    .map(
      (h) =>
        `- "${h.title}": ${symbol}${h.price.toLocaleString()} for ${h.hours}h (≈${symbol}${h.impliedHourlyRate.toFixed(
          0
        )}/hr)${h.discipline ? ` [${h.discipline}]` : ""}${label(h.outcome)}`
    )
    .join("\n");
  const anyTagged = history.some((h) => h.discipline);
  const byDiscipline = anyTagged
    ? " Some entries are tagged with the kind of work they were, in square brackets. Anchor hardest on the ones matching the discipline you name for this job: a build priced against design sprints comes out wrong in both directions."
    : "";
  const anyMarked = history.some((h) => h.outcome === "WON" || h.outcome === "LOST");
  const guidance = anyMarked
    ? " Weight the ones marked WON most heavily: those are prices this freelancer actually got paid. Treat the ones marked as turned down as evidence about what did not land, and do not reproduce their pricing without reason."
    : "";
  return `\nPricing history, past projects this freelancer has quoted, use these as the primary anchor for price and hours on similarly-scoped work.${guidance}${byDiscipline}\n${rows}`;
}

// A big uploaded PDF (a past quote, a lengthy SOW) can extract to tens of
// thousands of characters. Sending all of it adds latency and risks the
// serverless function running long enough to get killed, with no benefit —
// Claude only needs enough of the brief to scope and price it, not every
// word of a 40-page document. Truncate defensively; the note tells Claude
// (and, via the source text shown on the brief page, the user) that this
// happened.
const MAX_SOURCE_TEXT_CHARS = 20_000;

function truncateSourceText(text: string): string {
  if (text.length <= MAX_SOURCE_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_SOURCE_TEXT_CHARS)}\n\n[...source material truncated for length — ${text.length.toLocaleString()} characters total, only the first ${MAX_SOURCE_TEXT_CHARS.toLocaleString()} were used.]`;
}

/**
 * Tells the model which language to write in.
 *
 * Placed first in the prompt so it governs everything after it, and stated as
 * the language of the finished document rather than of the conversation: the
 * source brief is often in one language and the quote wanted in another.
 */
function languageInstruction(language?: Locale): string {
  if (!language || language === "en") return "";
  return 'Write the entire quote in Spanish, in neutral Latin American and European Spanish that reads naturally to both. Address the client as "tú", not "usted": freelance work is a relationship between two people, and "usted" puts a desk between them. Only use "usted" if this freelancer\'s saved tone notes ask for it. Keep industry terms that are normally used in English in English (brief, UX, PDF, Figma, sprint) rather than translating them into something less clear. This applies to every field you return, including titles, section text and open questions. The source material may be in another language; translate the meaning, do not copy its wording.';
}

/**
 * Which half of a quote a prompt is asking for.
 *
 * "all" is the old behaviour, kept because refine and the tests still want one
 * object. The split exists because output tokens are generated one after
 * another: a quote with strategy, terms, an SOW and a staged timeline was one
 * call writing three thousand tokens in series, and most of them were the
 * add-on sections rather than the quote itself.
 *
 * Nothing in the extras depends on the core. Findings and open questions come
 * from the brief, terms and revisions and availability describe how this
 * freelancer works, and the AI disclosure is about the kind of work rather than
 * the exact deliverable list. So the two can be written at the same time, and
 * the wait becomes the longer of the two instead of the sum.
 */
export type PromptPart = "all" | "core" | "extras";

export function buildGenerateUserPrompt(
  draft: QuoteDraftInput,
  pricingHistory: PricingHistoryEntry[] = [],
  /** A market-rate figure already researched (live or from the Postgres
   * cache — see ADR-0001 and lib/market-rate-cache), so the prompt can state
   * it directly instead of asking the model to run its own web_search. */
  marketRateNote?: string,
  part: PromptPart = "all"
): string {
  const hasHistory = pricingHistory.length > 0;
  const currencyCode = draft.currency || "USD";
  const symbol = currencySymbol(currencyCode);

  // The stated rate is the freelancer's decision, not a suggestion. Whichever
  // branch runs, price is hours x rate, and the rate itself is enforced in
  // code after parsing (see applyHourlyRate) because a model asked to
  // multiply will sometimes quietly price to what it thinks the market bears.
  const hasRate = draft.hourlyRate > 0;
  const unit: RateUnit = draft.rateUnit ?? "HOUR";
  // English on purpose, and the only place in the app where that is true of a
  // rate word. This string goes into the prompt, not onto the quote: the
  // instructions are written in English whatever language the output is asked
  // for, and translating the word "hour" inside them would make the prompt
  // harder for the model to follow, not easier for the client to read.
  const promptWords = dict("en").publicQuote;
  const rateLine = `${symbol}${draft.hourlyRate}${rateSuffix(unit, promptWords)} (currency: ${currencyCode})`;
  // "hours" stays the field the model fills in either case, since that is what
  // past quotes are compared on. Days are a pricing unit, not a second
  // estimate to keep in step.
  const priceRule =
    unit === "DAY"
      ? `set price = (hours / ${HOURS_PER_DAY}) x ${symbol}${draft.hourlyRate}, since the rate is per day and a working day is ${HOURS_PER_DAY} hours`
      : `set price = hours x ${symbol}${draft.hourlyRate}`;

  let pricingInstruction: string;
  if (hasRate && hasHistory) {
    pricingInstruction = `Pricing approach: this freelancer charges ${rateLine}. That rate is fixed and must be used exactly as given. Look at the pricing history below for comparable past work, estimate the hours this new project will realistically take, and ${priceRule}. Your only real decision here is the hours. Do not substitute a market rate, a rounder number, or a rate you consider more appropriate.`;
  } else if (hasRate) {
    pricingInstruction = `Pricing approach: this freelancer charges ${rateLine}. That rate is fixed and must be used exactly as given. Estimate the hours this project realistically needs for a "${draft.expertiseLevel}"-level freelancer, then ${priceRule}. Your only real decision here is the hours. Do not substitute a market rate, a rounder number, or a rate you consider more appropriate. If the stated rate looks well below or well above the going rate, say so in the open questions and leave the numbers alone.`;
  } else if (marketRateNote) {
    pricingInstruction = `Pricing approach: this freelancer has not given an hourly rate. Market research for this kind of work has already been done, going ${unitNoun(
      unit,
      promptWords
    )} rate across experience levels: ${marketRateNote}${formatPricingContext(
      draft.pricing
    )}
Place this freelancer within that range as a "${draft.expertiseLevel}"-level freelancer, adjusted for the client's market above if it's given. Then set hours, and price = hours x the rate you land on. State the rate you used, and where it came from, in the open questions so they can check it.`;
  } else {
    pricingInstruction = `Pricing approach: this freelancer has not given an hourly rate, so you set one from market research.${formatPricingContext(
      draft.pricing
    )}
Use web search to find the going ${unitNoun(unit, promptWords)} rate, and the typical hours, for this kind of project for a "${draft.expertiseLevel}"-level freelancer. Price against the client's market where one is given, since that is what sets what can be charged, and use the freelancer's own location as a cross-check. Then set hours, and price = hours x the rate you landed on. State the rate you used, and where it came from, in the open questions so they can check it.`;
  }

  // Milestones, when the freelancer asked for them. The count and the grouping
  // are both optional: saying neither means the model reads the natural shape
  // of the work, which is usually a better answer than a number picked before
  // anyone knew what the deliverables were.
  /**
   * Payment terms written from the choice, not asked for separately. This is
   * the single source: whatever is said here is what appears on the quote, so
   * the terms and the milestones cannot contradict each other.
   *
   * It used to be sent with the core half only, and paymentTerms is written by
   * the extras half. So the call that actually wrote the sentence never learned
   * which plan had been chosen, wrote something generic from the brief, and
   * then overwrote the core's correct version when the two halves were merged.
   * Changing the split from 50% to 30%, or to paid in full up front, changed
   * nothing on the finished quote. It goes with the half that writes it now.
   */
  const paymentInstruction = (() => {
    const plan = draft.paymentPlan;
    if (!plan) return "";
    // Said in the terms as well as in the fixed line the page appends, because
    // the model writes the schedule and a schedule that assumes a fixed total
    // reads as a contradiction next to an estimate.
    const basis =
      (draft.rateUnit ?? "HOUR") === "FIXED"
        ? ""
        : draft.billing === "HOURLY_TRACKED"
        ? ` The total shown is an estimate, and the client is billed for the hours actually worked at the stated rate. Never call it a fixed price, a capped price or a maximum.`
        : ` The total shown is a fixed total for this scope, whatever the hours turn out to be. Never describe it as an estimate or as subject to the hours worked.`;
    const opening = `\nWrite "paymentTerms" from this and nothing else, in one or two plain sentences, as the freelancer's own terms to their client. Do not invent a different schedule.${basis}`;
    if (plan === "UPFRONT") {
      return `${opening} The whole amount is due before the work starts.`;
    }
    if (plan === "ON_DELIVERY") {
      return `${opening} Nothing is due up front. The whole amount is invoiced on delivery, when the work is handed over.`;
    }
    if (plan === "SPLIT") {
      const up = draft.upfrontPercent ?? 50;
      return `${opening} ${up}% is due before the work starts and the remaining ${
        100 - up
      }% on delivery.`;
    }
    return `${opening} Each milestone is invoiced when it is completed, at the amount set out for it.`;
  })();

  // Fixed price changes what the numbers mean, so the model is told plainly.
  const fixedPriceInstruction =
    (draft.rateUnit ?? "HOUR") === "FIXED"
      ? `\nThis is quoted as a fixed price for the whole project, not as a rate. Still estimate hours honestly, since they inform the timeline, but the client is agreeing to the total. Never present an hourly or daily rate anywhere in the output.`
      : "";

  const milestoneInstruction = draft.paymentPlan === "MILESTONE"
    ? `\nInclude a "milestones" array.

A milestone is a billable chunk of the project, and it is NOT one deliverable renamed: a six-deliverable project is usually three or four milestones, not six.

If the source material already names the milestones, or describes the project in phases with dates attached, use those exactly: their number, their boundaries and their dates. Somebody who has written out "milestone 1 at the end of week 1, milestone 2 at the end of week 2" has told you the answer, and a different split invented here contradicts what they have already said to their client.

Decide the split by dependency, not by cutting the list into equal pieces. Ask what genuinely cannot start until something earlier is settled. Work that needs a direction agreed, a stakeholder decision, data access, or a technical choice made belongs AFTER the milestone where that gets settled, and the settling itself belongs INSIDE the earlier one. A milestone boundary is a point where the client has to do something before you can carry on, so put the boundary where that is actually true.

Each entry has:
- "name": 2-5 words for this chunk of work.
- "deliverableIndexes": 0-based positions in the deliverables array you produced, in order.
- "gate": what closes this milestone beyond its deliverables, when there is one. Usually an agreement rather than an artifact, phrased as a short concrete event: "Direction agreed with stakeholders", "Analytics access confirmed", "Content signed off". Omit it on a milestone that genuinely ends when the work is simply done.
- "amount": this milestone's share of the total price.

Rules: every deliverable appears in exactly one milestone, never two and never none. The amounts sum to exactly the total price. Weight each amount by how much work it represents, not by dividing equally, unless the chunks genuinely are equal.${
        draft.milestoneCount
          ? ` Use exactly ${draft.milestoneCount} milestones.`
          : " Choose the number of milestones yourself from the natural shape of the work, usually between two and four."
      }${
        draft.milestoneNotes?.trim()
          ? ` The freelancer has said how they want it split, follow this: "${draft.milestoneNotes.trim()}"`
          : ""
      }`
    : "";

  // Always asked for, on every quote. The questions inside it are notes to the
  // freelancer that never reach the client, so making them depend on a
  // client-facing section being switched on meant a quote with Strategy off
  // arrived with nothing flagged at all.
  const strategyInstruction = draft.chooseSections
    ? `\nInclude a "strategy" object. "openQuestions" is 2-4 notes for the freelancer only, never shown to the client: things worth confirming before starting, risks the brief glosses over, or a suggestion about how to approach the work they may not have considered. Always fill this in. "goal" and "findings" are the client-facing Approach section, and you decide whether this quote needs one: fill them in when the brief has enough substance that framing the problem adds something (a goal in one sentence, 2-4 concrete standalone observations drawn from the source material), and otherwise set "goal" to an empty string and "findings" to an empty array. Do not mention AI usage anywhere in this object, that's handled separately.`
    : draft.includeStrategy
    ? `\nInclude a "strategy" object, written the way a senior consultant frames a proposal's approach: "goal" is one sentence naming the outcome this project is actually for. "findings" is 2-4 concrete, standalone observations drawn from the source material (what's currently true / what's missing / what was asked for), each its own bullet, not one merged sentence. "openQuestions" is 2-4 notes for the freelancer only, never shown to the client: things worth confirming before starting, risks the brief glosses over, or a suggestion about how to approach the work that they may not have considered. Do not mention AI usage anywhere in this object, that's handled separately.`
    : `\nInclude a "strategy" object holding only "openQuestions": 2-4 notes for the freelancer, never shown to the client: things worth confirming before starting, risks the brief glosses over, or a suggestion about how to approach the work that they may not have considered. Set "goal" to an empty string and "findings" to an empty array, because this quote does not carry an Approach section and anything written there would go unused.`;

  // The Timeline toggle in the wizard is what decides this. Turned on, the
  // client gets a full staged breakdown, which is the part they scrutinise
  // most and where generated quotes are usually weakest, so the required
  // shape is spelled out rather than asking for "detail" in the abstract.
  // Turned off, they get a short summary line, because a quote that
  // deliberately leaves Timeline out shouldn't smuggle a full schedule back
  // in through the same field.
  //
  // When nobody asked for anything, the model is told to choose instead.
  // Everything section-shaped below then becomes "include this if it belongs",
  // and what comes back is recorded as the quote's sections.
  const decides = Boolean(draft.chooseSections);
  const ifChosen = decides ? "Only if this quote needs it: " : "";
  /**
   * A section the freelancer has written a note for is not optional.
   *
   * When the model chooses the sections, every instruction is prefixed with
   * "only if this quote needs it", and it was applying that to sections the
   * freelancer had actually filled in: somebody types their revisions policy,
   * the model decides the quote does not need one, and the policy they just
   * wrote never appears. Writing the note is the choice.
   */
  const required = (note?: string) =>
    note?.trim() ? "This quote includes this section, because the freelancer wrote it. " : ifChosen;
  /**
   * Which of their disciplines this job mostly is.
   *
   * Inferred rather than asked, because the alternative is another row on a
   * form that is already long, and the brief usually says plainly enough: a
   * request for six screens and a Webflow build is not a copywriting job.
   *
   * Named as a key so it can be stored and compared, and used for three things
   * afterwards: which past quotes anchor the price, which saved rate applies,
   * and how the scope is framed. A guess that is wrong is one press to fix on
   * the quote page, which is cheaper than a question everybody answers.
   */
  // Told, not guessed, whenever the freelancer said which work this is.
  //
  // They pick it in the rate row, and the rate they were given is that
  // discipline's rate. A model free to decide otherwise would write a
  // marketing quote priced at a design rate, which reads as a mistake to the
  // one person who can see both numbers.
  const chosenDiscipline = draft.disciplines?.find((d) => d.key === draft.discipline);

  const disciplineInstruction = chosenDiscipline
    ? `\nThis quote is for ${chosenDiscipline.key} (${chosenDiscipline.label}) work, and the rate you were given is this freelancer's rate for that work. Return "discipline" as exactly "${chosenDiscipline.key}". Write the whole quote as that kind of work: its deliverables, its vocabulary and the stages a client of that discipline expects.`
    : (draft.disciplines?.length ?? 0) > 1
      ? `\nThis freelancer does more than one kind of work: ${draft
          .disciplines!.map((d) => `${d.key} (${d.label})`)
          .join(
            ", "
          )}. Return a "discipline" key naming which one this job mostly is, using exactly one of those keys. Judge it by what the client is actually buying, not by which words appear most. A job that spans two is named by whichever carries the larger share of the work, and if it is genuinely even, name the first. Write the whole quote as that kind of work: its deliverables, its vocabulary and the stages a client of that discipline expects. A build quoted in the language of a design sprint reads like it was written for somebody else.`
      : "";

  const timelineInstruction = draft.includeTimeline
    ? `\nTimeline requirements. Return "timeline" as 4-6 stages, EACH ON ITS OWN LINE separated by a newline character, in the exact form "Week 1-2: Label - what actually happens". Rules:
- Start every line with a concrete week or day range ("Week 1", "Week 2-3", "Day 1-3"). Never "Phase one" or "Later" with no timing.
- Use the same unit on every line: all weeks, or all days. Never mix them.
- Stages run in order and their ranges must move forward. Two stages may share a range only when the work genuinely happens at the same time, and then the second one must say so in its detail. A client who sees "Week 2" twice cannot tell how long the project is.
- Give each stage a short label, then a dash, then specifics: the actual activities and what the client ends up holding at the end of it.
- Name real artifacts and real activities drawn from the deliverables and the source material, not generic filler like "design work" or "iteration".
- Say what is needed from the client and when (reviews, sign-off, content, access), since that is usually what actually determines the schedule.
- The stages must add up to a total duration consistent with the estimated hours.
Good: "Week 3-4: Design - wireframes for the 6 core screens, then two rounds of visual design on the strongest direction. Needs your sign-off on wireframes before visuals start."
Bad: "Week 3-4: Design phase" or "Design and iterate on the concepts".`
    : decides
    ? `\nTimeline requirements. You are choosing whether Timeline is its own section. If it is, return "timeline" as 4-6 stages, EACH ON ITS OWN LINE, in the form "Week 1-2: Label - what actually happens", naming real activities and saying what is needed from the client and when. If it is not, return "timeline" as a single short sentence giving the overall duration and rough shape.`
    : `\nTimeline requirements. Timeline is NOT being broken out as its own section on this quote, so return "timeline" as a single short sentence giving the overall duration and rough shape, e.g. "About 6 weeks from kickoff to handover, with design in the first half and build in the second." Do not return a staged, line-by-line breakdown.`;

  // Optional sections. Each is off unless asked for, so the baseline quote
  // stays scope, deliverables and price rather than a wall of boilerplate.
  const sectionChoiceInstruction = decides
    ? `\nNo sections were chosen for this quote, so choose them yourself. Judge from the brief and from what you know about how this freelancer works, and include the ones that earn their place: an Approach when the problem is worth framing, a staged timeline when the work has real stages, payment terms and a statement of work when the money or the commitment needs pinning down, terms when the engagement carries risk worth naming, a revisions policy when the work is the kind that attracts rounds of changes, an assumptions list whenever the price rests on quantities or on inputs somebody else supplies, a list of what would change the price when the brief leaves real room for the job to grow, an AI-use disclosure when AI genuinely touches this work. Two to four of them is usually right. Omit the key entirely for anything you leave out, and never include a section you would have to invent facts to fill.`
    : "";

  /**
   * The freelancer's own rules, as instructions.
   *
   * Only the ones a quote can actually satisfy. The rest are about what
   * somebody does before they open Freely at all, and telling a model to
   * enforce them would produce a paragraph nobody asked for.
   */
  const ruleInstruction = (() => {
    const on = new Set(draft.activeRules ?? []);
    if (on.size === 0) return "";
    const figures = draft.ruleValues ?? {};
    const lines: string[] = [];
    if (on.has("paymentBasis") && figures.paymentDays) {
      lines.push(
        `- Payment is due within ${figures.paymentDays} days of invoice. Say that number in the payment terms.` +
          (figures.depositPercent
            ? ` This freelancer takes ${figures.depositPercent}% before starting with a new client, so use that figure rather than a different split, unless the payment plan you were given above says otherwise.`
            : "")
      );
    }
    if (on.has("revisionRounds")) {
      lines.push(
        figures.revisionRounds !== undefined
          ? `- The revisions policy includes exactly ${figures.revisionRounds} rounds of changes. State that number, and say that further rounds are quoted and approved before they start.`
          : "- Any revisions policy must state an actual number of rounds. Never leave the count open."
      );
    }
    if (on.has("feedbackWindow")) {
      const days = figures.feedbackDays ?? 3;
      lines.push(
        `- Say that feedback and sign-off come back within ${days} business days, and that the delivery date moves by the same number of days when they do not.`
      );
    }
    if (on.has("deemedAcceptance")) {
      const days = figures.acceptanceDays ?? 10;
      lines.push(
        `- Say in the payment terms that delivered work with no response after ${days} business days counts as accepted, is invoiced, and that the next milestone starts.`
      );
    }
    if (on.has("includedCalls") && figures.callsIncluded !== undefined) {
      lines.push(
        `- Say that ${figures.callsIncluded} calls are included and that any beyond them are billed at the stated rate.`
      );
    }
    if (on.has("cancellation")) {
      lines.push(
        "- Any cancellation clause must say that completed work is invoiced, the part in progress is invoiced in full, and anything not started is not charged."
      );
    }
    if (on.has("ownership")) {
      lines.push(
        "- Any ownership clause must transfer rights on final payment rather than on delivery, and keep working files and unused concepts with the freelancer unless separately agreed."
      );
    }
    if (on.has("exclusions")) {
      lines.push(
        "- Name the work next door to this job that is NOT included, drawn from this brief: the adjacent tasks a client tends to assume are part of it. Say plainly that they are quoted separately."
      );
    }
    if (on.has("unpaidStretch") && draft.paymentPlan !== "MILESTONE") {
      lines.push(
        "- If this project is long enough that a single payment at the end would leave the freelancer carrying weeks of unpaid work, say so in the open questions and suggest splitting it."
      );
    }
    return lines.length > 0
      ? `\nThis freelancer keeps these rules on their quotes. Follow them wherever the relevant section exists, and do not mention the rules themselves:\n${lines.join(
          "\n"
        )}`
      : "";
  })();

  const notes = draft.sectionNotes ?? {};
  const extraSections: string[] = [];
  if (draft.includeTerms || decides) {
    extraSections.push(
      `${required(notes.terms)}Include a "terms" object: {"cancellation": string, "ownership": string, "confidentiality": string}. Write each as one or two plain-English sentences a freelancer would actually stand behind, not legalese, and do not invent jurisdiction-specific clauses.${
        notes.terms ? ` Build them around what they have stated: ${notes.terms}` : ""
      }`
    );
  }
  if (draft.includeRevisions || decides) {
    extraSections.push(
      notes.revisions
        ? `${required(notes.revisions)}Include a "revisions" string built on what they have stated: ${notes.revisions}. Say which stages it applies to and what counts as new work priced separately.`
        : `${ifChosen}Include a "revisions" string: how many rounds of changes are included at which stages, and what would count as new work priced separately. Base the number on the deliverables and hours, not a generic "two rounds". State an actual number of rounds. Never write "within reason", "as needed", "reasonable amends" or any other phrase that leaves the count open, since the freelancer and the client will read it differently at exactly the moment it matters.`
    );
  }
  // Only written when there is something to write it from. The old version
  // asked the model to state a start date and a weekly capacity it had no way
  // of knowing, which is how a quote ends up promising something the
  // freelancer never agreed to.
  const availabilityFacts = draft.availability?.facts.filter((f) => f.trim()) ?? [];
  if ((draft.includeAvailability || decides) && availabilityFacts.length > 0) {
    extraSections.push(
      `${ifChosen}Include an "availability" string built ONLY from what this freelancer has stated about their availability:\n${availabilityFacts
        .map((f) => `- ${f}`)
        .join(
          "\n"
        )}\nWrite it as one or two sentences in their voice. Do not add a start date, a weekly capacity, a response time or any other commitment that is not in that list.`
    );
  }
  if (draft.includeAssumptions || decides) {
    extraSections.push(
      `${required(notes.assumptions)}Include an "assumptions" array: 4-8 short lines naming what this price rests on. Each one must be a specific, checkable fact drawn from this brief, of the kind that would change the amount of work if it turned out otherwise: quantities (how many screens, pages, articles, components, languages), what exists already and in what condition, who supplies which inputs, how many people review, and what is out of scope. Write them as plain noun phrases, e.g. "12 screens across 2 flows", "copy supplied by you", "one round of consolidated feedback per milestone". Never write a generic line like "the client will be responsive" or "requirements are clear". End the list with a line in the freelancer's own voice saying that if any of these turns out differently they will flag it and agree a revised scope before continuing, so nothing arrives on an invoice unapproved.${
        notes.assumptions ? ` They have said: ${notes.assumptions}. Build the list around that.` : ""
      }`
    );
  }
  if (draft.includeScopeChanges || decides) {
    extraSections.push(
      `${required(notes.scopeChanges)}Include a "scopeChanges" array: 4-8 short lines naming what would change the price or the date on THIS project. Draw them from this brief rather than from a generic list, and cover the ones that actually bite: more of something than the quote assumes, a dependency that is not ready, work adjacent to the main job that tends to get assumed in (answering the client's developers, testing the built result, writing the copy, research, admin and access setup), a new decision-maker arriving partway through, a decision reversed after sign-off, and feedback or sign-off that does not come back inside the agreed window. Write each as a short phrase, not a sentence of consequences.${
        notes.scopeChanges ? ` They have said: ${notes.scopeChanges}. Build the list around that.` : ""
      }`
    );
  }
  if (draft.includeAI || decides) {
    extraSections.push(
      `${required(notes.aiUsage)}Include an "aiUsage" object: {"will": string[], "willNot": string[]}. This is a disclosure of how AI is used on THIS project, so both lists must name specific tasks from this brief, not general statements about AI.${
        notes.aiUsage ? ` They have said: ${notes.aiUsage}. Build both lists around that.` : ""
      } "will" is 2-4 mechanical or repetitive parts of the work where AI genuinely helps, for example scaffolding file structure, generating repetitive variants, first-pass copy, or converting formats. "willNot" is 2-4 parts that stay entirely human because they are judgement, taste or client-specific reasoning, for example deciding what to build, visual design decisions, or interpreting research. Write each entry as a short phrase naming the actual task.`
    );
  }
  if (draft.includeSOW || decides) {
    extraSections.push(
      `${ifChosen}Include a "paymentTerms" string describing WHEN money is due.${
        notes.payment
          ? ` Use what they have stated: ${notes.payment}`
          : " For example a deposit split and invoicing points tied to the stages."
      } Never include bank account details, card details or payment instructions: state that payment details are provided on the invoice.`
    );
  }
  const extraSectionsInstruction = extraSections.length
    ? `\n${extraSections.join("\n")}`
    : "";

  // What both halves need to know: the brief itself, and how to write.
  /**
   * The source is evidence, not copy.
   *
   * People paste whatever they have: email threads, chat logs, their own
   * replies to a client, notes to themselves. A real quote came back with a
   * freelancer's private email reasoning printed in the scope, including the
   * sentence about expecting to run over and absorbing it, because the model
   * treated the thread as text to summarise rather than as a record to read
   * facts out of. That is the freelancer's negotiating position, published to
   * the client under their own name.
   *
   * So the rule is stated before the source rather than after it, and it is
   * about voice as much as content: the quote is written from what the source
   * establishes, never out of its sentences.
   */
  const sourceInstruction = `\nThe source material below is evidence to read facts out of. It is NOT copy to reuse. It often contains email threads, chat logs, notes and the freelancer's own replies, and it was not written for the client to read.
- Never lift sentences, phrases or turns of phrase from the source into the quote. Establish the fact, then write it yourself in the flat, plain voice of a quote.
- Never carry across anything the freelancer said about their own position: what they are unsure of, what they expect to run over, what they are willing to absorb, what they will do differently next time, why they priced it as they did, how they feel about the client, or what they are hoping this leads to. A client reading their own quote must not learn any of it.
- Ignore pleasantries, apologies, hedges, asides and anything addressed to a person by name. "In all honesty", "to be fair", "I'm happy to" and the like never appear in the output.
- Never mention the tools the freelancer uses to run their own business, such as time trackers, invoicing apps or task boards, unless the client is being asked to use them too.
- Where the source states structure, use it rather than inventing your own: if it names milestones, dates, phases, quantities or who is responsible for what, those are the facts of this project and the quote must match them exactly.
- Where the source contradicts itself because it is a thread, the later message wins.`;

  const shared = [
    languageInstruction(draft.language),
    sourceInstruction,
    `Client brief / source material:\n${
      draft.sourceText ? truncateSourceText(draft.sourceText) : "(no source text provided)"
    }`,
    `\nInstructions for this quote: ${draft.instructions || "none given"}`,
    `Reference past projects to draw style from: ${
      draft.memoryProjectTitles.length ? draft.memoryProjectTitles.join(", ") : "none"
    }`,
  ];

  // The add-on sections, written on their own when asked for on their own.
  // The instruction to return nothing else is load-bearing: without it the
  // model helpfully writes a whole quote again, which is the cost this split
  // exists to avoid.
  if (part === "extras") {
    return [
      ...shared,
      `Output format requested: ${draft.format}. Include Statement of Work: ${draft.includeSOW}. Include AI-use disclosure: ${draft.includeAI}.`,
      sectionChoiceInstruction,
      strategyInstruction,
      extraSectionsInstruction,
      paymentInstruction,
      ruleInstruction,
      `\nReturn ONLY a JSON object containing the keys named above and nothing else. Do not include a title, client, scope, deliverables, timeline, price or hours: those are being written separately and anything you add here is discarded.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    ...shared,
    `Output format requested: ${draft.format}. Include Statement of Work: ${draft.includeSOW}. Include AI-use disclosure: ${draft.includeAI}.`,
    `\n${pricingInstruction}`,
    formatPricingHistory(pricingHistory, symbol),
    // Skipped on the core half, since the other call is writing them.
    disciplineInstruction,
    part === "all" ? sectionChoiceInstruction : "",
    part === "all" ? strategyInstruction : "",
    timelineInstruction,
    fixedPriceInstruction,
    // Only when this half is writing the whole quote. Split in two, the
    // paymentTerms sentence belongs to the extras call, and having both write
    // it meant the merge silently preferred the half that knew less.
    part === "all" ? paymentInstruction : "",
    milestoneInstruction,
    part === "all" ? extraSectionsInstruction : "",
    part === "all" ? ruleInstruction : "",
    // Which way their estimates usually miss, from time they actually tracked.
    part === "all" ? draft.estimateHabit ?? "" : "",
    // A real client could not tell whether "Design review session" and
    // "Feedback-incorporated final files" were the one included round or two
    // more on top of it. They were the same round, listed twice as though
    // they were things being bought.
    `\nDeliverables are things the client ends up holding. Never list a review, a feedback session, a revision round, a handover call or an amends pass as a deliverable: those describe the process, and where they are part of the deal they belong in the revisions policy or the timeline. If a file exists in a draft form and a final form, that is one deliverable, not two.`,
    `\nWrite a project quote based on this. Keep deliverables as a list of short, concrete items (4-7 items), name actual artifacts, not phases. Give a realistic timeline, a price in ${currencyCode}, and estimated hours that are consistent with the pricing approach above.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Whether this quote has a second half worth a second call.
 *
 * All of these off is a bare quote: scope, deliverables, timeline, price. That
 * is one short call and already fast, so the split would only add a round trip
 * to something that does not need one.
 */
export function wantsExtras(draft: QuoteDraftInput): boolean {
  const hasAvailability =
    Boolean(draft.includeAvailability) &&
    (draft.availability?.facts.some((f) => f.trim()) ?? false);
  return Boolean(
    // Choosing means everything is on the table, so the second call has to
    // happen: skipping it would decide "no sections" on the model's behalf.
    draft.chooseSections ||
      draft.includeStrategy ||
      draft.includeTerms ||
      draft.includeRevisions ||
      draft.includeAI ||
      draft.includeSOW ||
      hasAvailability
  );
}

/** What a refine needs to know about the quote beyond its text. */
export interface RefineContext {
  /** The language it was written in, so a refine cannot switch it. */
  language?: Locale;
  /** How the client pays, in the freelancer's own words. */
  paymentTerms?: string;
  currency?: string;
  rateUnit?: RateUnit;
  hourlyRate?: number | null;
  /** Sections the freelancer has taken out. Named so a refine can put one
   * back when asked and leave it out when not. */
  removedSections?: string[];
}

export function buildRefineUserPrompt(
  current: GeneratedBrief,
  refinePrompt: string,
  context: RefineContext = {}
): string {
  /**
   * The whole quote goes in, and the whole quote comes back.
   *
   * This used to send the core fields only: no terms, no revisions, no payment
   * terms, no availability, no AI disclosure. So "make it 30% up front" or
   * "add a revisions policy" reached a model that could not see the sections
   * being talked about, and it changed the scope instead. What came back had
   * no sections in it either, so the stored ones survived untouched and the
   * instruction appeared to do nothing.
   *
   * Adding and removing are both allowed, because "drop the AI disclosure" is
   * as ordinary a request as "soften the terms", and the alternative was
   * going back to the wizard and regenerating from scratch.
   */
  const facts: string[] = [];
  if (context.hourlyRate) {
    const unit =
      context.rateUnit === "FIXED"
        ? "as a fixed price"
        : context.rateUnit === "DAY"
          ? "per day"
          : "per hour";
    facts.push(`The rate behind the price is ${context.hourlyRate} ${context.currency ?? "USD"} ${unit}.`);
  }
  if (context.removedSections?.length) {
    facts.push(
      `Sections the freelancer has taken out of this quote: ${context.removedSections.join(
        ", "
      )}. Leave them out unless the instruction asks for one back.`
    );
  }

  return [
    languageInstruction(context.language),
    `Here is the current quote, in full:\n${JSON.stringify(current)}`,
    `\nRevise it based on this instruction: "${refinePrompt}". Keep everything else as close to the original as makes sense.`,
    facts.length ? `\n${facts.join(" ")}` : "",
    `\nReturn the whole quote, including every optional section it already has: strategy, terms, revisions, availability, assumptions, scopeChanges, paymentTerms and aiUsage. A section the instruction does not mention comes back exactly as it was, word for word. Do not drop a section because the instruction was about something else.`,
    `\nYou may add a section this quote does not have, or leave one out, when the instruction asks for it: "add a revisions policy" means write one, "take out the AI disclosure" means omit that key entirely. Do not add one that was not asked for, and never invent facts to fill a section, particularly availability, which may only say what the freelancer has already stated.`,
    context.paymentTerms
      ? `\nThe payment terms currently read: "${context.paymentTerms}". If the instruction changes how or when the money is paid, rewrite them to match and make sure any milestones agree with them.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}


/** Strips markdown fences and parses+validates the model's JSON response. */
/**
 * Pulls the JSON object out of a reply that may have prose around it.
 *
 * Web search makes the model narrate what it found before answering, and that
 * narration can contain braces ("a rate of {x}", a code sample, a stray
 * bracket). A greedy first-brace-to-last-brace match then spans from the
 * prose into the JSON and parses as nothing. This walks the string tracking
 * depth, ignoring braces inside strings, and returns the last complete
 * top-level object, which is where the answer is.
 */
export function extractJsonObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  let last: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && start !== -1) last = text.slice(start, i + 1);
      if (depth < 0) depth = 0;
    }
  }
  return last;
}

/**
 * Stand-in wording for anything the model left blank.
 *
 * Deliberately generic and obviously a placeholder: "Client" reads as a gap to
 * fill, where a guessed company name reads as a fact and would go out to a real
 * client as one.
 */
function fillGaps(brief: GeneratedBrief, language?: Locale): GeneratedBrief {
  const t = dict(language ?? "en");
  return {
    ...brief,
    title: brief.title.trim() || t.quote.untitledQuote,
    client: brief.client.trim() || t.quote.unnamedClient,
    scope: brief.scope.trim(),
    timeline: brief.timeline.trim(),
  };
}

export function parseBriefResponse(text: string, language?: Locale): GeneratedBrief {
  const stripped = text.replace(/```json/gi, "").replace(/```/g, "");
  const cleaned = (extractJsonObject(stripped) ?? stripped).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // An unclosed object almost always means the reply was cut short, and
    // "invalid JSON" tells the person nothing they can act on.
    const truncated = cleaned.trimEnd().startsWith("{") && !cleaned.trimEnd().endsWith("}");
    throw new Error(
      truncated
        ? "The quote came back cut off part way through. Try again, or turn off a section or two."
        : "The AI did not return valid JSON for the brief."
    );
  }
  const result = briefSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Brief response failed validation: ${result.error.message}`);
  }
  return fillGaps(result.data, language);
}

/** The name of the exported function making the call, not the prompt
 * content — a fixed set so a rename can't silently desync the log label. */
type LlmJob =
  | "generateBriefFromDraft"
  | "extractProjectFromDocument"
  | "generatePersona"
  | "analyzeBrandGuide"
  | "analyzeBrandGuideFromImage"
  | "refineBrief"
  | "breakDownDeliverable"
  | "plainDeliverableNames"
  | "researchMarketRate"
  | "generateQuoteExtras"
  | "suggestSections"
  | "planQuote"
  | "researchBenchmark";

interface LlmCallLog {
  job: LlmJob;
  model: string;
  ok: boolean;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  error?: string;
}

/** One shape whether the call succeeded or not, so a log pipeline never has
 * to handle two different `[llm]` payloads. */
function logLlmCall(entry: LlmCallLog): void {
  const line = JSON.stringify(entry);
  if (entry.ok) console.log("[llm]", line);
  else console.error("[llm]", line);
}

/** Every LLM call goes through this, so cost/latency are never a guess. */
async function loggedCreate(
  job: LlmJob,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  const anthropic = getClient();
  const start = Date.now();
  try {
    const response = await anthropic.messages.create(params);
    const pricing = PRICING_PER_MTOK[params.model];
    const costUsd = pricing
      ? (response.usage.input_tokens / 1_000_000) * pricing.input +
        (response.usage.output_tokens / 1_000_000) * pricing.output
      : null;
    logLlmCall({
      job,
      model: params.model,
      ok: true,
      latencyMs: Date.now() - start,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      costUsd: costUsd === null ? null : Number(costUsd.toFixed(4)),
    });
    return response;
  } catch (err) {
    logLlmCall({
      job,
      model: params.model,
      ok: false,
      latencyMs: Date.now() - start,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function callClaude(
  job: LlmJob,
  system: string,
  userPrompt: string,
  opts: {
    webSearch?: boolean;
    maxTokens?: number;
    /** Extraction or a short rewrite, where the smaller model is as good. */
    small?: boolean;
  } = {}
): Promise<string> {
  const response = await loggedCreate(job, {
    model: opts.small ? SMALL_MODEL : MODEL,
    max_tokens: opts.maxTokens ?? 2000,
    system,
    messages: [{ role: "user", content: userPrompt }],
    ...(opts.webSearch
      ? {
          tools: [
            {
              type: "web_search_20250305" as const,
              name: "web_search" as const,
              max_uses: 5,
            },
          ],
        }
      : {}),
  });
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  if (!text) throw new Error("The AI returned an empty response.");
  // Running out of room mid-JSON produces a half-written object, which then
  // surfaces as an unhelpful "didn't return valid JSON". Say what actually
  // happened instead.
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "The quote came back longer than the space allowed and got cut off. Try again, or turn off a section or two."
    );
  }
  return text;
}

/**
 * Whether this generation should spend time on live web research for market
 * rates. Research is only useful in the first place when there's nothing of
 * the freelancer's own to anchor to — no pricing history, and no rate given
 * — but usefulness alone isn't enough to turn it on: it also has to be asked
 * for, since it adds real latency to the slowest, most-used LLM call and
 * must not slow down the default path. See "Gate web_search out of the
 * default quote-generation path".
 */
export function shouldResearchMarketRates(
  draft: Pick<QuoteDraftInput, "researchMarketRates" | "hourlyRate">,
  pricingHistory: PricingHistoryEntry[]
): boolean {
  return Boolean(draft.researchMarketRates) && (pricingHistory.length === 0 || draft.hourlyRate <= 0);
}

/**
 * Whether it's worth resolving a market-rate note (live or cached, see
 * lib/market-rate-cache) before generation at all. Narrower than
 * shouldResearchMarketRates: that also turns on for a stated rate with no
 * pricing history (to nudge a live web_search check into the same call), but
 * buildGenerateUserPrompt's pricing instruction only ever reads a
 * marketRateNote once there's no stated rate — so resolving one whenever
 * hasRate is true would be a paid-for lookup nothing in the prompt uses.
 */
export function needsMarketRateNote(
  draft: Pick<QuoteDraftInput, "researchMarketRates" | "hourlyRate">,
  pricingHistory: PricingHistoryEntry[]
): boolean {
  return shouldResearchMarketRates(draft, pricingHistory) && draft.hourlyRate <= 0;
}

/**
 * The core of a quote: everything the client reads first.
 *
 * Split out so the wait can end when this lands rather than when the whole
 * document does. The add-on sections take about as long again and none of them
 * are needed to look at a price, so holding the page shut until they arrive
 * spends somebody's attention on paragraphs they have not scrolled to yet.
 */
export async function generateQuoteCore(
  memory: MemoryContext,
  draft: QuoteDraftInput,
  pricingHistory: PricingHistoryEntry[] = [],
  marketRateNote?: string
): Promise<GeneratedBrief> {
  const system = buildSystemPrompt(memory);
  const webSearch = shouldResearchMarketRates(draft, pricingHistory) && !marketRateNote;
  const prompt = buildGenerateUserPrompt(
    draft,
    pricingHistory,
    marketRateNote,
    wantsExtras(draft) ? "core" : "all"
  );

  const text = await callClaude("generateBriefFromDraft", system, prompt, {
    webSearch,
    maxTokens: 8000,
  });

  const core = await (async () => {
    try {
      return parseBriefResponse(text, draft.language);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const shapeFailure =
        message.includes("did not return valid JSON") || message.includes("failed validation");
      if (!shapeFailure) throw err;
      const retry = await callClaude(
        "generateBriefFromDraft",
        system,
        `${prompt}\n\nReturn ONLY the JSON object described above. No preamble, no explanation, no code fences, no text of any kind before or after it.`,
        { maxTokens: 8000 }
      );
      return parseBriefResponse(retry, draft.language);
    }
  })();

  return applyHourlyRate(core, draft.hourlyRate, draft.rateUnit ?? "HOUR");
}

/**
 * The add-on sections, written on their own against the same brief.
 *
 * Called after the quote exists and its page is open, so a failure here loses
 * the terms and keeps the quote. That is the right way round: a quote with no
 * revisions policy is still a quote, and throwing away a generation somebody
 * has already read would be the worse trade.
 */
export async function generateQuoteExtras(
  memory: MemoryContext,
  draft: QuoteDraftInput,
  pricingHistory: PricingHistoryEntry[] = [],
  marketRateNote?: string
): Promise<BriefExtras & { strategy?: Strategy }> {
  const system = buildSystemPrompt(memory);
  const text = await callClaude(
    "generateQuoteExtras",
    system,
    buildGenerateUserPrompt(draft, pricingHistory, marketRateNote, "extras"),
    { maxTokens: 4000 }
  );
  return parseExtrasResponse(text) as BriefExtras & { strategy?: Strategy };
}

export async function generateBriefFromDraft(
  memory: MemoryContext,
  draft: QuoteDraftInput,
  pricingHistory: PricingHistoryEntry[] = [],
  /** A market rate already known (from the cache, or a fresh
   * researchMarketRate call) — see lib/market-rate-cache. When given, this
   * call never runs its own web_search: the rate is already in the prompt. */
  marketRateNote?: string
): Promise<GeneratedBrief> {
  const system = buildSystemPrompt(memory);
  const webSearch = shouldResearchMarketRates(draft, pricingHistory) && !marketRateNote;
  const split = wantsExtras(draft);

  // Both halves at once. Output tokens are written one after another, so a
  // quote that used to be one call producing three thousand of them now
  // produces roughly half that in each of two calls running side by side, and
  // the wait is the longer one rather than the total.
  //
  // Only the core half can search. The web search is for a market rate, which
  // only the pricing instruction reads, and running it twice would pay for the
  // same lookup in both calls.
  const corePrompt = buildGenerateUserPrompt(
    draft,
    pricingHistory,
    marketRateNote,
    split ? "core" : "all"
  );

  const [coreText, extrasText] = await Promise.all([
    callClaude("generateBriefFromDraft", system, corePrompt, {
      webSearch,
      // A quote with strategy, terms, an SOW and a staged timeline is already
      // long, and the research path writes a preamble before the JSON. At 2000
      // it was being truncated mid-object.
      maxTokens: 8000,
    }),
    split
      ? callClaude(
          "generateQuoteExtras",
          system,
          buildGenerateUserPrompt(draft, pricingHistory, marketRateNote, "extras"),
          { maxTokens: 4000 }
        )
      : Promise.resolve(""),
  ]);

  /**
   * One retry when the reply is not the JSON we asked for.
   *
   * The model occasionally narrates before answering, or answers in a shape
   * the schema rejects, and the person waiting has done nothing wrong: they
   * see an error, lose the wait they already spent, and press the button
   * again. That is the retry, so do it here where the prompt is already
   * built and can be made blunter.
   *
   * Only for shape failures. A rate limit, a refusal or a truncated reply
   * says something real and is passed straight through, because retrying
   * those spends money to produce the same message twice.
   */
  const core = await (async () => {
    try {
      return parseBriefResponse(coreText, draft.language);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const shapeFailure =
        message.includes("did not return valid JSON") || message.includes("failed validation");
      if (!shapeFailure) throw err;
      const retry = await callClaude(
        "generateBriefFromDraft",
        system,
        `${corePrompt}\n\nReturn ONLY the JSON object described above. No preamble, no explanation, no code fences, no text of any kind before or after it.`,
        { maxTokens: 8000 }
      );
      return parseBriefResponse(retry, draft.language);
    }
  })();

  // Merged after parsing, and never over a value the core already produced.
  // A failure here loses the add-on sections and keeps the quote, which is the
  // right way round: a quote with no terms is still a quote, and throwing away
  // a generation somebody waited for because a revisions string came back
  // malformed would be the worse trade.
  const merged = extrasText ? { ...core, ...parseExtrasResponse(extrasText) } : core;

  return applyHourlyRate(merged, draft.hourlyRate, draft.rateUnit ?? "HOUR");
}

/**
 * The add-on sections, or nothing.
 *
 * Never throws. Everything it returns is optional in the schema, so an
 * unreadable reply costs the sections and nothing else. The alternative is
 * discarding a quote that has already been paid for and waited on.
 */
export function parseExtrasResponse(text: string): Partial<GeneratedBrief> {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return {};
    const parsed = extrasOnlySchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    if (!parsed.success) {
      console.error("[parseExtrasResponse] failed validation", parsed.error.issues);
      return {};
    }
    // Only keys that actually arrived, so a missing one cannot overwrite
    // something the core produced with undefined.
    return Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    ) as Partial<GeneratedBrief>;
  } catch (err) {
    console.error("[parseExtrasResponse] could not read the reply", err);
    return {};
  }
}

/** The second half's shape. Every key optional, since every section is. */
const extrasOnlySchema = z.object({
  strategy: strategySchema.optional(),
  terms: briefExtrasSchema.shape.terms,
  revisions: briefExtrasSchema.shape.revisions,
  availability: briefExtrasSchema.shape.availability,
  assumptions: briefExtrasSchema.shape.assumptions,
  scopeChanges: briefExtrasSchema.shape.scopeChanges,
  paymentTerms: briefExtrasSchema.shape.paymentTerms,
  aiUsage: briefExtrasSchema.shape.aiUsage,
});

export interface MarketRateQuery {
  /** ISO 3166-1 alpha-2. Their stated country, or the one their currency
   * implies. The single biggest thing that moves the answer: the same job
   * pays multiples more in one place than another, and a rate researched
   * without it is an average of the world. */
  country: string;
  /** Onboarding's industry key (or free-text "other" value). Callers pass a
   * shared fallback string, not null, so accounts with no industry set still
   * land in one cache bucket rather than skipping the cache. */
  industry: string;
  currency: string;
  rateUnit: RateUnit;
}

/**
 * Researches the going rate for one (country, industry, currency, rateUnit)
 * combination — independent of any one freelancer's expertise level, client,
 * or city, so the result in lib/market-rate-cache can be reused across
 * every freelancer who shares that combination (ADR-0001). Returns prose: a
 * rate or range, and where it came from, the same shape a live web_search
 * aside used to produce inline inside generateBriefFromDraft.
 */
export async function researchMarketRate(query: MarketRateQuery): Promise<MarketRateAnswer> {
  const promptWords = dict("en").publicQuote;
  const system =
    'You research freelance market rates. Use web search, then answer with JSON and nothing else, in this exact shape: {"note": "...", "levels": {"Junior": {"low": 0, "high": 0}, "Mid-level": {"low": 0, "high": 0}, "Senior": {"low": 0, "high": 0}, "Expert": {"low": 0, "high": 0}}}. ' +
    "The note is one short paragraph: the going rate as a number or a realistic range, and a short clause on where it came from (the kind of source, not a URL or citation). Research the rate freelancers based in the country given actually charge, and say the country in the note so it can be checked. " +
    "Every number is a whole amount in the currency and rate unit given, with no symbols, no thousands separators and no text. All four levels are required, since one answer is reused for freelancers at every level. No preamble, no markdown, no code fences.";
  const user = `Country: ${
    countryName(query.country) ?? query.country
  }\nIndustry: ${query.industry}\nCurrency: ${query.currency}\nRate unit: per ${unitNoun(
    query.rateUnit,
    promptWords
  )}\n\nWhat is the going rate?`;
  // Sonnet, not Haiku: this is the same judgment the pricing branch it
  // replaces already paid for — weighing conflicting search results into one
  // defensible rate/range — not a transcription or short-rewrite job.
  const text = await callClaude("researchMarketRate", system, user, {
    webSearch: true,
    maxTokens: 900,
  });

  // The prose is the part that must survive. A model that ignores the JSON
  // shape still usually writes a usable paragraph, and losing the whole answer
  // over a malformed blob would mean no rate note in the quote either.
  const parsed = readJson(text);
  const note = typeof parsed?.note === "string" && parsed.note.trim() ? parsed.note.trim() : text.trim();
  return { note, levels: parseLevels(parsed?.levels) };
}

/** The research, as a paragraph and as numbers. Numbers may be null. */
export interface MarketRateAnswer {
  note: string;
  levels: RateLevels | null;
}

/**
 * The JSON out of a reply, tolerantly.
 *
 * Models add a code fence about one time in twenty however plainly the prompt
 * says not to, and that is not a reason to throw away a good answer.
 */
function readJson(text: string): { note?: unknown; levels?: unknown } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Forces price = hours x the stated rate.
 *
 * The prompt says this plainly, and the model still drifted: a quote built on
 * a stated 40/hr came back priced at an implied 105/hr. The rate is the one
 * number the freelancer has actually decided, so it is enforced here rather
 * than asked for. Hours stay as generated, since that is the part that
 * genuinely calls for judgment.
 */
export function applyHourlyRate(
  brief: GeneratedBrief,
  hourlyRate: number,
  unit: RateUnit = "HOUR"
): GeneratedBrief {
  if (hourlyRate <= 0 || brief.hours <= 0) return brief;
  const price = priceFor(brief.hours, hourlyRate, unit);
  if (price === brief.price) return brief;
  return { ...brief, price };
}

export const projectExtractionSchema = z.object({
  title: z.string().min(1),
  client: z.string().min(1),
  timeline: z.string().min(1),
  deliverables: z.array(z.string()).min(1),
});
export type ExtractedProject = z.infer<typeof projectExtractionSchema>;

/** Reads an uploaded brief/SOW and pulls out a project title, client name,
 * timeline, and a deliverables checklist — used by Track's "Upload a brief"
 * flow to create a Project directly, without going through the Quote
 * wizard's pricing step. */
export async function extractProjectFromDocument(sourceText: string): Promise<ExtractedProject> {
  const system = [
    "You read freelance briefs, statements of work, and contracts and extract structured project information.",
    "Deliverables should be short, concrete checklist items (not phases), 3-10 items.",
    "Timeline should be a short human-readable description (e.g. '4 weeks, kicking off Aug 1').",
    'Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly: {"title": string, "client": string, "timeline": string, "deliverables": string[]}',
  ].join(" ");
  const user = `Document:\n${truncateSourceText(sourceText)}\n\nExtract the project title, client name, timeline, and deliverables checklist.`;
  const text = await callClaude("extractProjectFromDocument", system, user);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const cleaned = (jsonMatch ? jsonMatch[0] : text).replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("The AI did not return valid JSON for the project extraction.");
  }
  const result = projectExtractionSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Project extraction failed validation: ${result.error.message}`);
  }
  return result.data;
}

export interface PersonaInput {
  industry?: string | null;
  toneNotes?: string;
  storyNotes?: string;
  contextNotes?: string;
  fileExcerpts?: { name: string; text: string }[];
  pastProjectTitles?: string[];
}

export const personaSchema = z.object({
  summary: z.string(),
  /**
   * A seniority read, or null when the material does not support one.
   *
   * Read here rather than asked in the wizard. Seniority only moves a number
   * when there is no rate to anchor to, so asking on every quote was a
   * question whose answer usually changed nothing; and the same material this
   * persona is built from says it anyway.
   *
   * Nullable and it means it: no signal is a better answer than a guess, since
   * a wrong level quietly shifts a researched price.
   */
  expertise: z.enum(["Junior", "Mid-level", "Senior", "Expert"]).nullable().default(null),
});
export type PersonaResult = z.infer<typeof personaSchema>;

/** Synthesizes a short, editable persona summary from everything saved to
 * Memory plus past project titles — "who this freelancer is and how they
 * work," inferred rather than manually filled in. Always presented to the
 * user as a starting point they can correct, never as a locked-in fact.
 *
 * Also returns a seniority read, used only when the freelancer has not stated
 * one and only when a rate has to be researched. See lib/quote-defaults. */
export async function generatePersona(input: PersonaInput): Promise<PersonaResult> {
  const system = [
    "You write short, third-person persona summaries for freelancers using a quoting tool called Freely.",
    "The summary should read like a colleague's honest one-paragraph description of how this person works, specific, not generic corporate-bio language.",
    "Base it only on the material given. If material is thin, keep the summary short and hedge lightly (e.g. 'appears to' / 'so far') rather than inventing detail.",
    "summary is plain text: 2-4 sentences, no headers, no markdown, no quotes around it.",
    'expertise is your read of their seniority from the material: one of "Junior", "Mid-level", "Senior", "Expert". Judge it on evidence of scope and responsibility, years of work, the kind of client, and how they describe their own role. If the material does not really support a read, use null. Null is the right answer more often than a guess: this affects the rate researched for them when they have not given one.',
    'Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly: {"summary": string, "expertise": "Junior"|"Mid-level"|"Senior"|"Expert"|null}',
  ].join(" ");

  const sections = [
    input.industry ? `Industry: ${input.industry}` : null,
    input.storyNotes?.trim() ? `Studio story: ${input.storyNotes.trim()}` : null,
    input.toneNotes?.trim() ? `Tone preferences: ${input.toneNotes.trim()}` : null,
    input.contextNotes?.trim() ? `Additional context: ${input.contextNotes.trim()}` : null,
    input.pastProjectTitles?.length
      ? `Past project titles: ${input.pastProjectTitles.join(", ")}`
      : null,
    input.fileExcerpts?.length
      ? `Saved reference files:\n${input.fileExcerpts
          .map((f) => `--- ${f.name} ---\n${f.text.slice(0, 2000)}`)
          .join("\n\n")}`
      : null,
  ].filter(Boolean);

  if (sections.length === 0) {
    return {
      summary:
        "Not enough saved in Memory yet to build a persona, add a bit of Story, Tone, or a reference file first.",
      expertise: null,
    };
  }

  const user = `Here's what's saved about this freelancer:\n\n${sections.join(
    "\n\n"
  )}\n\nWrite the persona summary and read their seniority.`;

  // Two to four sentences and a seniority read. No judgement about a client's
  // money, so no reason to pay for the larger model.
  const text = await callClaude("generatePersona", system, user, { small: true });
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const cleaned = (jsonMatch ? jsonMatch[0] : text)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    const result = personaSchema.safeParse(JSON.parse(cleaned));
    if (result.success) return result.data;
  } catch {
    // Falls through.
  }
  // A persona that came back as prose rather than JSON is still a usable
  // persona, and losing it over its wrapper would be a worse outcome than
  // going without the seniority read.
  return { summary: text.trim(), expertise: null };
}

export const brandGuideSchema = z.object({
  primaryColor: z.string().nullable().default(null),
  accentColor: z.string().nullable().default(null),
  headingFont: z.string().nullable().default(null),
  bodyFont: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});
export type BrandGuideAnalysis = z.infer<typeof brandGuideSchema>;

/** Reads the (already text-extracted) contents of an uploaded brand
 * guidelines PDF and pulls out whatever it can find: a primary color, an
 * accent color, and heading/body font names. Reasons from what the document
 * actually says (hex codes, named colors, typeface names) — doesn't guess
 * at anything not present. Logos are handled as a separate, explicit upload
 * (see uploadBrandLogoAction) since reliably extracting a specific logo
 * asset out of a laid-out PDF page isn't something text extraction can do. */
export async function analyzeBrandGuide(sourceText: string): Promise<BrandGuideAnalysis> {
  // Most guides state all four outright, and reading them off the page costs
  // nothing. The model is for the ones written as prose. See lib/brand-scan.
  const scanned = scanBrandGuide(sourceText);
  if (scanIsComplete(scanned)) return { ...scanned, notes: null };

  const system = [
    "You read brand/style guideline documents and extract concrete, stated facts only.",
    "primaryColor and accentColor must be valid hex codes (e.g. \"#6320EE\"), if the document only names a color (\"deep violet\") without a hex code, convert it to the closest reasonable hex value. If no color guidance is present at all, use null.",
    "headingFont and bodyFont are typeface names exactly as written in the document (e.g. \"Raleway\", \"Helvetica Neue\"). If the document only specifies one font for everything, use it for both. If no typography guidance is present, use null.",
    "notes is one short sentence flagging anything else worth a human's attention (e.g. \"Guide also specifies a secondary/tertiary palette not captured here\"), or null if there's nothing else notable.",
    'Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly: {"primaryColor": string|null, "accentColor": string|null, "headingFont": string|null, "bodyFont": string|null, "notes": string|null}',
  ].join(" ");
  const user = `Brand guideline document:\n${sourceText.slice(0, 12000)}\n\nExtract the primary color, accent color, heading font, and body font.`;
  // Extraction, not judgement.
  const text = await callClaude("analyzeBrandGuide", system, user, { small: true });
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const cleaned = (jsonMatch ? jsonMatch[0] : text).replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Couldn't read a brand guide out of that document.");
  }
  const result = brandGuideSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Brand guide analysis failed validation: ${result.error.message}`);
  }
  return result.data;
}

const BRAND_GUIDE_IMAGE_SYSTEM_PROMPT = [
  "You read brand/style guideline images (screenshots, exported style-guide pages, moodboards) and extract concrete, visible facts only.",
  "primaryColor and accentColor must be valid hex codes (e.g. \"#6320EE\") for the two most prominent brand colors actually shown in the image. If you can't tell, use null, never guess a color that isn't visibly present.",
  "headingFont and bodyFont are typeface names only if they're explicitly labeled in the image (e.g. a swatch captioned \"Raleway\"). If no typeface is named in the image, use null, don't guess a font from how the text merely looks.",
  "notes is one short sentence flagging anything else worth a human's attention, or null if there's nothing else notable.",
  'Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly: {"primaryColor": string|null, "accentColor": string|null, "headingFont": string|null, "bodyFont": string|null, "notes": string|null}',
].join(" ");

/** Same job as analyzeBrandGuide, but for an uploaded PNG/JPG (a screenshot
 * of a style guide, a moodboard, an exported brand page) instead of a
 * text-extractable document — sent straight to Claude as an image rather
 * than through /api/extract-text, since there's no text to pull out of a
 * picture. Deliberately conservative about fonts: a screenshot only lets
 * Claude *see* a typeface, not know its name, so it's told to only report a
 * font if the image actually labels one. */
export async function analyzeBrandGuideFromImage(
  base64Data: string,
  mediaType: "image/png" | "image/jpeg"
): Promise<BrandGuideAnalysis> {
  const response = await loggedCreate("analyzeBrandGuideFromImage", {
    model: MODEL,
    max_tokens: 1000,
    system: BRAND_GUIDE_IMAGE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          {
            type: "text",
            text: "Extract the primary color, accent color, heading font, and body font from this brand guideline image.",
          },
        ],
      },
    ],
  });
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  if (!text) throw new Error("The AI returned an empty response.");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const cleaned = (jsonMatch ? jsonMatch[0] : text).replace(/```json/gi, "").replace(/```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Couldn't read a brand guide out of that image.");
  }
  const result = brandGuideSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Brand guide analysis failed validation: ${result.error.message}`);
  }
  return result.data;
}

export async function refineBrief(
  memory: MemoryContext,
  current: GeneratedBrief,
  refinePrompt: string,
  context: RefineContext = {}
): Promise<GeneratedBrief> {
  const system = buildSystemPrompt(memory);

  /**
   * One section, when the instruction is clearly about one.
   *
   * "Add a cancellation clause" used to send the whole quote and get the whole
   * quote back, rewriting the scope, the deliverables and the timeline on the
   * way past. That is most of the wait, and it is why a sentence somebody
   * liked could come back subtly different after an instruction about
   * something else entirely.
   *
   * Anything ambiguous still rewrites everything, because an instruction that
   * appears to do nothing is worse than one that is slow. See lib/refine-scope.
   */
  const scope = scopeOf(refinePrompt);
  if (scope) {
    const scoped = await refineSection(system, current, refinePrompt, scope, context);
    if (scoped) return scoped;
    // The narrow answer came back unusable. Falling through costs the wait it
    // was trying to save and produces a correct quote, which is the right way
    // round.
  }

  const user = buildRefineUserPrompt(current, refinePrompt, context);
  // Room for the whole quote coming back rather than just its core, which is
  // what the default 2000 was sized for.
  const text = await callClaude("refineBrief", system, user, { maxTokens: 6000 });
  // In the language it was written in. Without this a Spanish quote could come
  // back with an English placeholder title.
  return parseBriefResponse(text, context.language);
}

/**
 * Rewriting one section, with the rest of the quote as context.
 *
 * The whole quote still goes in, because a revisions policy written without
 * sight of the deliverables is a policy about nothing. Only one key comes
 * back, and only that key is kept: the model can return more than it was
 * asked for, and a scoped refine that quietly rewrote the deliverables would
 * be exactly the failure this exists to prevent, and invisible.
 */
async function refineSection(
  system: string,
  current: GeneratedBrief,
  refinePrompt: string,
  scope: RefineScope,
  context: RefineContext
): Promise<GeneratedBrief | null> {
  const key = keyFor(scope);
  const user = [
    buildRefineUserPrompt(current, refinePrompt, context),
    `\nAnswer with ONE key only: {"${key}": ...}, in the same shape that key has above. Do not return any other key, and do not return the rest of the quote: everything else is staying exactly as it is and anything else you send will be discarded.`,
  ].join("\n");

  try {
    const text = await callClaude("refineBrief", system, user, { maxTokens: 1500 });
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;

    const answer = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const kept = keepOnly(answer, scope);
    if (Object.keys(kept).length === 0) return null;

    // Validated as a whole quote, so a malformed section cannot land as one.
    const merged = { ...current, ...kept } as unknown;
    const parsed = briefSchema.safeParse(merged);
    return parsed.success ? parsed.data : null;
  } catch (err) {
    console.error("[refineSection] failed", err);
    return null;
  }
}


/* ------------------------------------------------------------------ */
/* Track: breaking a deliverable into work                             */
/* ------------------------------------------------------------------ */

export const stepSchema = z.object({
  name: z.string().min(1),
  /** Rough hours. The model is asked for something defensible rather than a
   * round number, and 0 is allowed when it genuinely cannot say. */
  estimateHours: z.number().min(0).max(200),
});

export const flagSchema = z.object({
  question: z.string().min(1),
  reason: z.string().min(1),
  kind: z.enum(["BLOCKER", "ASSUMPTION", "WORTH_ASKING"]),
});

export const breakdownSchema = z.object({
  /** A short label. The generated deliverable name is a client-facing
   * sentence, which is useless as a heading in a list of your own work. */
  title: z.string().min(1).max(80).optional(),
  /** One line on what this deliverable actually means here. */
  summary: z.string().min(1),
  steps: z.array(stepSchema).min(1).max(12),
  flags: z.array(flagSchema).max(4),
});

export type DeliverableBreakdown = z.infer<typeof breakdownSchema>;

export interface BreakdownInput {
  projectTitle: string;
  client: string;
  /** The deliverable being broken down. */
  deliverable: string;
  /** The other deliverables, so steps do not duplicate work that belongs
   * elsewhere in the project. */
  siblingDeliverables: string[];
  /** The quote's scope and timeline, which is the only description of the
   * project the model has. */
  scope?: string;
  timeline?: string;
  /** Hours budgeted for the whole project, so estimates stay in proportion
   * to what was actually sold. */
  projectHours?: number;
}

export function buildBreakdownPrompt(input: BreakdownInput): string {
  const parts = [
    `Project: ${input.projectTitle}`,
    `Client: ${input.client}`,
    input.scope ? `Scope of the project:\n${input.scope}` : "",
    input.timeline ? `Timeline:\n${input.timeline}` : "",
    input.siblingDeliverables.length
      ? `All deliverables on this project:\n${input.siblingDeliverables.map((d) => `- ${d}`).join("\n")}`
      : "",
    input.projectHours
      ? `The whole project was quoted at ${input.projectHours} hours across ${
          input.siblingDeliverables.length || 1
        } deliverables, so keep your estimates in proportion to that.`
      : "",
    "",
    `Break this one deliverable into the actual steps of doing it: "${input.deliverable}"`,
    "",
    'Rules for the steps. Each step is something a person can sit down and start, phrased as an action: "Audit the existing type styles and list every size in use", not "Typography". Anything that just renames the deliverable is useless, so no "Set up the foundations" or "Build the components". Put them in the order they would actually be done, including the unglamorous parts (naming, file setup, handover notes, a review round with the client) that get forgotten when a deliverable is written as one line in a quote. Between 4 and 10 steps. Give each an hours estimate that a freelancer would recognise as realistic, and use 0 only when the step genuinely cannot be estimated.',
    "",
    'Rules for the flags. Zero is the normal answer. Only include something if it would genuinely stall or redo the work: a decision that has not been made, a dependency outside their control, a gap in the brief that changes what gets built. Most deliverables have none, so return an empty array unless there is a real risk. At most two, and never more than one BLOCKER. This freelancer knows their craft, so nothing about how to do the work, no best practice, no reminders to communicate with the client, and nothing already answered by the scope. Write the question in one short sentence and the reason in one short clause, not a paragraph. Mark it BLOCKER only when the work cannot proceed correctly until it is answered.',
    "",
    'Also return "title": a short label for this deliverable, two to five words, no description and no trailing punctuation. The name you were given is written for a client to read; this is what the freelancer sees at the top of a list of their own work. "Token foundations", "Core components", "Developer handoff".',
    "",
    'Respond with ONLY valid JSON, no markdown fences, no commentary: {"title": string, "summary": string, "steps": [{"name": string, "estimateHours": number}], "flags": [{"question": string, "reason": string, "kind": "BLOCKER" | "ASSUMPTION" | "WORTH_ASKING"}]}. "summary" is one sentence on what this deliverable means on this particular project, not a definition of the term.',
  ];
  return parts.filter(Boolean).join("\n");
}

/**
 * Turns a deliverable into steps and flags.
 *
 * A quote's deliverables are written to be read by a client ("Foundations in
 * Figma"), which makes them useless as a to-do list. This is the translation
 * from what was sold to what has to be done, and it is deliberately per
 * deliverable rather than for the whole project at once: a prompt asked to
 * break down six things at once gives six shallow answers.
 */
export async function breakDownDeliverable(
  memory: MemoryContext,
  input: BreakdownInput
): Promise<DeliverableBreakdown> {
  // Saved files are dropped here rather than at the call site, so no future
  // caller can put them back by accident.
  //
  // A breakdown answers "what are the steps, and what could go wrong": the
  // material for that is the quote and the deliverable being planned. A brand
  // guide does not make the steps better, and every saved file was being sent
  // with every breakdown, so a full Memory quietly multiplied the size of a
  // call that never read the extra material.
  const system = [
    buildSystemPrompt({ ...memory, fileExcerpts: [] }),
    "You are now planning delivery, not selling. Write for the freelancer doing the work, not for the client: no pitch language, no reassurance, just what has to happen.",
  ].join("\n\n");
  const text = await callClaude("breakDownDeliverable", system, buildBreakdownPrompt(input));
  return parseBreakdownResponse(text);
}

export function parseBreakdownResponse(text: string): DeliverableBreakdown {
  const stripped = text.replace(/```json/gi, "").replace(/```/g, "");
  const cleaned = (extractJsonObject(stripped) ?? stripped).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("The AI did not return valid JSON for the breakdown.");
  }
  const result = breakdownSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Breakdown failed validation: ${result.error.message}`);
  }
  return result.data;
}

export const plainNamesSchema = z.object({
  names: z.array(z.string()),
});

/**
 * The deliverables, said the way a client would say them.
 *
 * The tracker's names are written for the person doing the work: "Swap font
 * from Inter to Sohne across all 13 text styles" is a task with a definition of
 * done in it. A client reading their own project page is not managing that
 * task, they are buying an outcome, and the task version reads like somebody
 * else's to-do list left on their desk.
 *
 * Rewritten rather than summarised: one line in, one line out, same order, same
 * count. The mapping has to survive so a name can be traced back to the
 * deliverable it belongs to, which is also why the count is checked rather than
 * trusted.
 *
 * Written once and then editable, so a correction is never overwritten by a
 * regeneration.
 */
export async function plainDeliverableNames(
  names: string[],
  language: Locale = "en"
): Promise<string[]> {
  if (names.length === 0) return [];

  const system = [
    "You rewrite a freelancer's internal task names as short lines a client can read on their project page.",
    "Keep the meaning and the outcome. Drop tool names, file names, counts of internal objects, and anything that only makes sense to the person doing the work.",
    "Say what the client gets, not what was done to achieve it. \"Swap font from Inter to Sohne across all 13 text styles\" becomes \"Brand typeface applied across the whole design\".",
    "Each line is under 60 characters, sentence case, no trailing full stop, no jargon, no marketing language, no em dashes.",
    "Do not invent work that is not in the input, do not merge two inputs into one line, and do not drop any.",
    language === "es"
      ? 'Write them in Spanish, neutral between Latin America and Spain, addressing the client as "tú" rather than "usted".'
      : "Write them in English.",
    'Respond with ONLY valid JSON, no markdown fences, matching exactly: {"names": string[]}',
  ].join(" ");

  const user = `Rewrite each of these ${names.length} lines, in the same order:\n${names
    .map((n, i) => `${i + 1}. ${n}`)
    .join("\n")}`;

  // One short line in, one short line out, with the meaning already decided.
  const text = await callClaude("plainDeliverableNames", system, user, { small: true });
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const cleaned = (jsonMatch ? jsonMatch[0] : text)
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    const parsed = plainNamesSchema.safeParse(JSON.parse(cleaned));
    // A short list would silently mis-map every name after the gap, so a
    // mismatch is a failure rather than something to pad out.
    if (parsed.success && parsed.data.names.length === names.length) {
      // Through the same sanitiser as generated quote text, so the house rules
      // about dashes and contrastive phrasing hold here too.
      return parsed.data.names.map((n) => sanitizeText(n).trim());
    }
  } catch {
    // Falls through.
  }
  throw new Error("Couldn't rewrite those in plain language. Try again.");
}

/**
 * Which sections this brief wants, read before the quote is written.
 *
 * Haiku, and capped short. This runs while somebody is still in the wizard
 * deciding what to ask for, so it has to come back in a couple of seconds and
 * cost almost nothing; the judgement it makes is "does this brief mention
 * three reviewers", which is reading rather than reasoning.
 *
 * Failure is quiet by design. The suggestions are an offer, and a wizard that
 * shows an error because an optional convenience did not arrive is worse than
 * one that simply does not offer it. See lib/suggest-sections.
 */
export async function suggestSections(input: {
  sourceText: string;
  instructions?: string;
  disciplineLine?: string;
  language: string;
}): Promise<SuggestionResponse | null> {
  const { system, user } = buildSuggestPrompt(input);
  try {
    const text = await callClaude("suggestSections", system, user, {
      small: true,
      maxTokens: 700,
    });
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const parsed = suggestionResponseSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    console.error("[suggestSections] failed", err);
    return null;
  }
}

/**
 * The plan, before the quote.
 *
 * Sonnet rather than Haiku, and this is the one place it is worth arguing
 * about. Everything downstream rests on this reading: get the split or the
 * quantities wrong here and the freelancer approves a plan that produces a
 * wrong quote, which is worse than the old order where at least the mistake
 * was visible in the finished document. It is still a fraction of what
 * generation costs, because it writes a paragraph and some names rather than a
 * whole quote.
 *
 * Returns nothing on failure. The wizard falls back to writing the quote
 * directly, which is exactly what it did before this step existed.
 */
export async function planQuote(input: {
  sourceText: string;
  instructions?: string;
  disciplineLine?: string;
  language: string;
  ruleStatements: string[];
}): Promise<QuotePlan | null> {
  const { system, user } = buildPlanPrompt(input);
  try {
    const text = await callClaude("planQuote", system, user, { maxTokens: 1600 });
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const parsed = planSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    console.error("[planQuote] failed", err);
    return null;
  }
}

/**
 * One benchmark, researched.
 *
 * Web search, because the whole point is that the figures come from somewhere
 * that can be named. Sonnet rather than Haiku for the same reason the rate
 * research uses it: weighing several sources that disagree into one defensible
 * range is judgement, and a cheaper model tends to pick the first number it
 * sees.
 *
 * Runs on a cron rather than in a request, so it can afford to be slow.
 */
export async function researchBenchmark(
  key: BenchmarkKey,
  labels: { industry: string; country: string }
): Promise<BenchmarkFacts | null> {
  const { system, user } = buildBenchmarkPrompt(key, labels);
  try {
    const text = await callClaude("researchBenchmark", system, user, {
      webSearch: true,
      maxTokens: 1200,
    });
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    const parsed = benchmarkSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    if (!parsed.success) {
      console.error("[researchBenchmark] failed validation", parsed.error.issues);
      return null;
    }
    // A range the wrong way round is a transcription slip rather than a
    // finding, and swapping it is safer than throwing the answer away.
    const facts = parsed.data;
    return facts.rateLow <= facts.rateHigh
      ? facts
      : { ...facts, rateLow: facts.rateHigh, rateHigh: facts.rateLow };
  } catch (err) {
    console.error("[researchBenchmark] failed", err);
    return null;
  }
}
