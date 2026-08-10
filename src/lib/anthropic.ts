import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { currencySymbol } from "@/lib/currencies";
import type { SectionNotes } from "@/lib/quote-prompts";
import {
  priceFor,
  rateSuffix,
  unitNoun,
  HOURS_PER_DAY,
  type RateUnit,
} from "@/lib/rate-unit";

const MODEL = "claude-sonnet-4-6";

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
  goal: z.string().min(1),
  findings: z.array(z.string()).min(1),
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

export const briefSchema = z.object({
  title: z.string().min(1),
  client: z.string().min(1),
  scope: z.string().min(1),
  deliverables: z.array(z.string()).min(1),
  timeline: z.string().min(1),
  /** Optional structured "Strategy" section. Only populated when the
   * wizard's "Strategy" section is included. */
  strategy: strategySchema.optional(),
  price: z.number().nonnegative(),
  hours: z.number().nonnegative(),
  terms: briefExtrasSchema.shape.terms,
  revisions: briefExtrasSchema.shape.revisions,
  availability: briefExtrasSchema.shape.availability,
  paymentTerms: briefExtrasSchema.shape.paymentTerms,
  aiUsage: briefExtrasSchema.shape.aiUsage,
});

export type GeneratedBrief = z.infer<typeof briefSchema>;

/** A past quoted (and ideally tracked/accepted) project, used to anchor
 * pricing and hour estimates for a new quote. */
export interface PricingHistoryEntry {
  title: string;
  price: number;
  hours: number;
  impliedHourlyRate: number;
}

export interface QuoteDraftInput {
  sourceText: string;
  instructions: string;
  memoryProjectTitles: string[];
  detailLevel: "Generic" | "Detailed";
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
  /** Cancellation, ownership and confidentiality terms. */
  includeTerms?: boolean;
  /** How many revision rounds are included. */
  includeRevisions?: boolean;
  /** Capacity, start date and response times. */
  includeAvailability?: boolean;
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
    "Every number you write, hours, price, timeline, should be defensible. Reason from the stated hourly rate and any pricing history provided, not from round numbers that merely sound reasonable.",
    ctx.instructions?.trim() || null,
    ctx.toneNotes?.trim() ? `Tone notes: ${ctx.toneNotes.trim()}` : null,
    ctx.storyNotes?.trim() ? `Studio story / background: ${ctx.storyNotes.trim()}` : null,
    ctx.contextNotes?.trim() ? `Additional context: ${ctx.contextNotes.trim()}` : null,
    ctx.fileExcerpts?.length
      ? `Reference material from saved files:\n${ctx.fileExcerpts
          .map((f) => `--- ${f.name} ---\n${f.text.slice(0, 4000)}`)
          .join("\n\n")}`
      : null,
    'Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this schema: {"title": string, "client": string, "scope": string, "deliverables": string[], "timeline": string, "strategy": {"goal": string, "findings": string[], "openQuestions": string[]} (optional object, omit entirely if Strategy wasn\'t requested), "price": number, "hours": number, "terms": {"cancellation": string, "ownership": string, "confidentiality": string} (optional), "revisions": string (optional), "availability": string (optional), "paymentTerms": string (optional), "aiUsage": {"will": string[], "willNot": string[]} (optional)}. Omit any optional key entirely unless it was explicitly requested. Never put bank account numbers, sort codes, IBANs, card details or any other payment credentials anywhere in the response, not even as an example or placeholder: quotes can be published to a public web address, so payment details belong only on an invoice. Each findings/openQuestions entry should be one short, standalone bullet point, not a run-on sentence with several ideas mashed together, and never numbered manually (e.g. no "(1)" prefixes) since the UI renders them as a real bulleted list. If you used web search to research rates, do not include citations or URLs in the JSON, fold the conclusion into your reasoning about price only.',
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

function formatPricingHistory(history: PricingHistoryEntry[], symbol: string): string {
  if (!history.length) return "";
  const rows = history
    .map(
      (h) =>
        `- "${h.title}": ${symbol}${h.price.toLocaleString()} for ${h.hours}h (≈${symbol}${h.impliedHourlyRate.toFixed(
          0
        )}/hr)`
    )
    .join("\n");
  return `\nPricing history, past projects this freelancer has quoted, use these as the primary anchor for price and hours on similarly-scoped work:\n${rows}`;
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

export function buildGenerateUserPrompt(
  draft: QuoteDraftInput,
  pricingHistory: PricingHistoryEntry[] = []
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
  const rateLine = `${symbol}${draft.hourlyRate}${rateSuffix(unit)} (currency: ${currencyCode})`;
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
  } else {
    pricingInstruction = `Pricing approach: this freelancer has not given an hourly rate, so you set one from market research.${formatPricingContext(
      draft.pricing
    )}
Use web search to find the going ${unitNoun(unit)} rate, and the typical hours, for this kind of project for a "${draft.expertiseLevel}"-level freelancer. Price against the client's market where one is given, since that is what sets what can be charged, and use the freelancer's own location as a cross-check. Then set hours, and price = hours x the rate you landed on. State the rate you used, and where it came from, in the open questions so they can check it.`;
  }

  const strategyInstruction = draft.includeStrategy
    ? `\nInclude a "strategy" object, written the way a senior consultant frames a proposal's approach: "goal" is one sentence naming the outcome this project is actually for. "findings" is 2-4 concrete, standalone observations drawn from the source material (what's currently true / what's missing / what was asked for), each its own bullet, not one merged sentence. "openQuestions" is 2-4 notes for the freelancer only, never shown to the client: things worth confirming before starting, risks the brief glosses over, or a suggestion about how to approach the work that they may not have considered. Do not mention AI usage anywhere in this object, that's handled separately.`
    : "";

  // The Timeline toggle in the wizard is what decides this. Turned on, the
  // client gets a full staged breakdown, which is the part they scrutinise
  // most and where generated quotes are usually weakest, so the required
  // shape is spelled out rather than asking for "detail" in the abstract.
  // Turned off, they get a short summary line, because a quote that
  // deliberately leaves Timeline out shouldn't smuggle a full schedule back
  // in through the same field.
  const timelineInstruction = draft.includeTimeline
    ? `\nTimeline requirements. Return "timeline" as 4-6 stages, EACH ON ITS OWN LINE separated by a newline character, in the exact form "Week 1-2: Label - what actually happens". Rules:
- Start every line with a concrete week or day range ("Week 1", "Week 2-3", "Day 1-3"). Never "Phase one" or "Later" with no timing.
- Give each stage a short label, then a dash, then specifics: the actual activities and what the client ends up holding at the end of it.
- Name real artifacts and real activities drawn from the deliverables and the source material, not generic filler like "design work" or "iteration".
- Say what is needed from the client and when (reviews, sign-off, content, access), since that is usually what actually determines the schedule.
- The stages must add up to a total duration consistent with the estimated hours.
Good: "Week 3-4: Design - wireframes for the 6 core screens, then two rounds of visual design on the strongest direction. Needs your sign-off on wireframes before visuals start."
Bad: "Week 3-4: Design phase" or "Design and iterate on the concepts".`
    : `\nTimeline requirements. Timeline is NOT being broken out as its own section on this quote, so return "timeline" as a single short sentence giving the overall duration and rough shape, e.g. "About 6 weeks from kickoff to handover, with design in the first half and build in the second." Do not return a staged, line-by-line breakdown.`;

  // Optional sections. Each is off unless asked for, so the baseline quote
  // stays scope, deliverables and price rather than a wall of boilerplate.
  const notes = draft.sectionNotes ?? {};
  const extraSections: string[] = [];
  if (draft.includeTerms) {
    extraSections.push(
      `Include a "terms" object: {"cancellation": string, "ownership": string, "confidentiality": string}. Write each as one or two plain-English sentences a freelancer would actually stand behind, not legalese, and do not invent jurisdiction-specific clauses.${
        notes.terms ? ` Build them around what they have stated: ${notes.terms}` : ""
      }`
    );
  }
  if (draft.includeRevisions) {
    extraSections.push(
      notes.revisions
        ? `Include a "revisions" string built on what they have stated: ${notes.revisions}. Say which stages it applies to and what counts as new work priced separately.`
        : 'Include a "revisions" string: how many rounds of changes are included at which stages, and what would count as new work priced separately. Base the number on the deliverables and hours, not a generic "two rounds".'
    );
  }
  // Only written when there is something to write it from. The old version
  // asked the model to state a start date and a weekly capacity it had no way
  // of knowing, which is how a quote ends up promising something the
  // freelancer never agreed to.
  const availabilityFacts = draft.availability?.facts.filter((f) => f.trim()) ?? [];
  if (draft.includeAvailability && availabilityFacts.length > 0) {
    extraSections.push(
      `Include an "availability" string built ONLY from what this freelancer has stated about their availability:\n${availabilityFacts
        .map((f) => `- ${f}`)
        .join(
          "\n"
        )}\nWrite it as one or two sentences in their voice. Do not add a start date, a weekly capacity, a response time or any other commitment that is not in that list.`
    );
  }
  if (draft.includeAI) {
    extraSections.push(
      `Include an "aiUsage" object: {"will": string[], "willNot": string[]}. This is a disclosure of how AI is used on THIS project, so both lists must name specific tasks from this brief, not general statements about AI.${
        notes.aiUsage ? ` They have said: ${notes.aiUsage}. Build both lists around that.` : ""
      } "will" is 2-4 mechanical or repetitive parts of the work where AI genuinely helps, for example scaffolding file structure, generating repetitive variants, first-pass copy, or converting formats. "willNot" is 2-4 parts that stay entirely human because they are judgement, taste or client-specific reasoning, for example deciding what to build, visual design decisions, or interpreting research. Write each entry as a short phrase naming the actual task.`
    );
  }
  if (draft.includeSOW) {
    extraSections.push(
      `Include a "paymentTerms" string describing WHEN money is due.${
        notes.payment
          ? ` Use what they have stated: ${notes.payment}`
          : " For example a deposit split and invoicing points tied to the stages."
      } Never include bank account details, card details or payment instructions: state that payment details are provided on the invoice.`
    );
  }
  const extraSectionsInstruction = extraSections.length
    ? `\n${extraSections.join("\n")}`
    : "";

  return [
    `Client brief / source material:\n${
      draft.sourceText ? truncateSourceText(draft.sourceText) : "(no source text provided)"
    }`,
    `\nInstructions for this quote: ${draft.instructions || "none given"}`,
    `Detail level: ${draft.detailLevel}`,
    `Reference past projects to draw style from: ${
      draft.memoryProjectTitles.length ? draft.memoryProjectTitles.join(", ") : "none"
    }`,
    `Output format requested: ${draft.format}. Include Statement of Work: ${draft.includeSOW}. Include AI-use disclosure: ${draft.includeAI}.`,
    `\n${pricingInstruction}`,
    formatPricingHistory(pricingHistory, symbol),
    strategyInstruction,
    timelineInstruction,
    extraSectionsInstruction,
    `\nWrite a project quote based on this. Keep deliverables as a list of short, concrete items (4-7 items), name actual artifacts, not phases. Give a realistic timeline, a price in ${currencyCode}, and estimated hours that are consistent with the pricing approach above.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRefineUserPrompt(
  current: GeneratedBrief,
  refinePrompt: string
): string {
  return `Here is the current quote:\n${JSON.stringify(current)}\n\nRevise it based on this instruction: "${refinePrompt}". Keep everything else as close to the original as makes sense.`;
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

export function parseBriefResponse(text: string): GeneratedBrief {
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
  return result.data;
}

async function callClaude(
  system: string,
  userPrompt: string,
  opts: { webSearch?: boolean; maxTokens?: number } = {}
): Promise<string> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
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

export async function generateBriefFromDraft(
  memory: MemoryContext,
  draft: QuoteDraftInput,
  pricingHistory: PricingHistoryEntry[] = []
): Promise<GeneratedBrief> {
  const system = buildSystemPrompt(memory);
  const user = buildGenerateUserPrompt(draft, pricingHistory);
  // Research the market when there is nothing of their own to anchor to,
  // either because there is no history or because no rate was given.
  const text = await callClaude(system, user, {
    webSearch: pricingHistory.length === 0 || draft.hourlyRate <= 0,
    // A quote with strategy, terms, an SOW and a staged timeline is already
    // long, and the research path writes a preamble before the JSON. At 2000
    // it was being truncated mid-object.
    maxTokens: 8000,
  });
  return applyHourlyRate(parseBriefResponse(text), draft.hourlyRate, draft.rateUnit ?? "HOUR");
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
  const text = await callClaude(system, user);
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

/** Synthesizes a short, editable persona summary from everything saved to
 * Memory plus past project titles — "who this freelancer is and how they
 * work," inferred rather than manually filled in. Always presented to the
 * user as a starting point they can correct, never as a locked-in fact. */
export async function generatePersona(input: PersonaInput): Promise<string> {
  const system = [
    "You write short, third-person persona summaries for freelancers using a quoting tool called Freely.",
    "The summary should read like a colleague's honest one-paragraph description of how this person works, specific, not generic corporate-bio language.",
    "Base it only on the material given. If material is thin, keep the summary short and hedge lightly (e.g. 'appears to' / 'so far') rather than inventing detail.",
    "Respond with plain text only: 2-4 sentences, no headers, no markdown, no quotes around it.",
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
    return "Not enough saved in Memory yet to build a persona, add a bit of Story, Tone, or a reference file first.";
  }

  const user = `Here's what's saved about this freelancer:\n\n${sections.join(
    "\n\n"
  )}\n\nWrite the persona summary.`;

  return callClaude(system, user);
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
  const system = [
    "You read brand/style guideline documents and extract concrete, stated facts only.",
    "primaryColor and accentColor must be valid hex codes (e.g. \"#6320EE\"), if the document only names a color (\"deep violet\") without a hex code, convert it to the closest reasonable hex value. If no color guidance is present at all, use null.",
    "headingFont and bodyFont are typeface names exactly as written in the document (e.g. \"Raleway\", \"Helvetica Neue\"). If the document only specifies one font for everything, use it for both. If no typography guidance is present, use null.",
    "notes is one short sentence flagging anything else worth a human's attention (e.g. \"Guide also specifies a secondary/tertiary palette not captured here\"), or null if there's nothing else notable.",
    'Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly: {"primaryColor": string|null, "accentColor": string|null, "headingFont": string|null, "bodyFont": string|null, "notes": string|null}',
  ].join(" ");
  const user = `Brand guideline document:\n${sourceText.slice(0, 12000)}\n\nExtract the primary color, accent color, heading font, and body font.`;
  const text = await callClaude(system, user);
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
  const anthropic = getClient();
  const response = await anthropic.messages.create({
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
  refinePrompt: string
): Promise<GeneratedBrief> {
  const system = buildSystemPrompt(memory);
  const user = buildRefineUserPrompt(current, refinePrompt);
  const text = await callClaude(system, user);
  return parseBriefResponse(text);
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
  const system = [
    buildSystemPrompt(memory),
    "You are now planning delivery, not selling. Write for the freelancer doing the work, not for the client: no pitch language, no reassurance, just what has to happen.",
  ].join("\n\n");
  const text = await callClaude(system, buildBreakdownPrompt(input));
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
