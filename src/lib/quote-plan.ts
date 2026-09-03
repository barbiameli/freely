import { z } from "zod";
import { ALL_SECTIONS } from "@/lib/quote-defaults";

/**
 * What Freely intends to write, before it writes it.
 *
 * The old order was: fill in a form, press Generate, wait, and find out what
 * you got. When the reading was wrong, and on a brief pasted out of an email
 * thread it often was, the only repair was another full generation. So the
 * expensive call now comes second, and something cheap and fast goes first: a
 * plan, stating what it took the job to be, how it would split it, which
 * sections it would carry, and what it could not work out.
 *
 * The plan is not a draft. Nothing in it is written in the quote's voice and
 * none of it is client-facing, which is deliberate: reading a half-finished
 * quote invites editing prose, and the thing worth correcting at this point is
 * the understanding underneath it.
 */
export const planSchema = z.object({
  /** What the job is, in two or three plain sentences, for the freelancer. */
  reading: z.string().default(""),
  /**
   * How the work splits.
   *
   * Named here rather than at generation because the split is the part a
   * freelancer most often disagrees with, and disagreeing with it after the
   * fact means rewriting the deliverables, the timeline and the schedule
   * together.
   */
  milestones: z
    .array(
      z.object({
        name: z.string(),
        /** What closes it. Usually an agreement rather than an artifact. */
        gate: z.string().default(""),
        /** Roughly what lands, 2 to 5 words each. */
        delivers: z.array(z.string()).default([]),
      })
    )
    .default([]),
  /** Sections worth carrying, with a reason each. Same shape as the wizard's. */
  sections: z
    .array(z.object({ key: z.string(), reason: z.string() }))
    .default([]),
  /**
   * What it could not work out, as questions.
   *
   * Only things that change the work: quantities, who reviews, what exists
   * already, what the freelancer has actually seen. A question whose answer
   * would not move the price or the shape is a question that costs somebody
   * time for nothing, so the prompt asks for few and asks for material ones.
   */
  questions: z
    .array(
      z.object({
        /** Short and answerable in a line. */
        ask: z.string(),
        /** What Freely will assume if it goes unanswered. */
        assume: z.string().default(""),
      })
    )
    .default([]),
  /** The brief describes something nobody has opened yet. */
  sightUnseen: z.boolean().default(false),
  /**
   * How much armour this job looks like it needs.
   *
   * Proposed rather than decided: the freelancer knows things about a client
   * that no brief contains, and the answer is theirs. But asking cold gets a
   * shrug, and a proposal with its reasons attached gets a considered yes or
   * a considered no.
   */
  protection: z.enum(["KNOWN", "NEW", "GUARDED"]).default("NEW"),
  /**
   * What in the brief led to that, in the freelancer's language.
   *
   * Shown next to the proposal, because "guarded, because there is no budget
   * and no named decision-maker" is a judgement somebody can disagree with,
   * and "guarded" on its own is a machine telling them to be worried.
   */
  risks: z.array(z.string()).default([]),
});

export type QuotePlan = z.infer<typeof planSchema>;

/** One answered question, on its way into the quote. */
export interface PlanAnswer {
  ask: string;
  answer: string;
}

/**
 * The answers, as lines the generation prompt can use.
 *
 * Answered questions become facts. Unanswered ones become the assumption the
 * plan already named, which is the whole point of naming it: a question
 * somebody skipped still ends up written down on the quote rather than
 * quietly guessed.
 */
export function answersForPrompt(plan: QuotePlan, answers: PlanAnswer[]): string {
  const given = new Map(answers.map((a) => [a.ask, a.answer.trim()]));
  const lines: string[] = [];

  for (const question of plan.questions) {
    const answer = given.get(question.ask);
    if (answer) lines.push(`- ${question.ask} ${answer}`);
    else if (question.assume) lines.push(`- ${question.ask} Not answered, so assume: ${question.assume}`);
  }
  if (lines.length === 0) return "";

  return `The freelancer was asked about the gaps in this brief. Treat an answer as fact. Where they did not answer, use the assumption given and put it in the assumptions list rather than leaving it unsaid:\n${lines.join(
    "\n"
  )}`;
}

/** The agreed milestones, as instruction rather than suggestion. */
export function milestonesForPrompt(plan: QuotePlan, keep: string[]): string {
  const kept = plan.milestones.filter((m) => keep.includes(m.name));
  if (kept.length === 0) return "";
  return `The freelancer has already agreed this split, so use it exactly: ${kept.length} milestones, in this order, with these names and these gates. Do not merge them, split them further, or rename them.\n${kept
    .map(
      (m, i) =>
        `${i + 1}. ${m.name}${m.gate ? ` (closes on: ${m.gate})` : ""}${
          m.delivers.length ? ` covering ${m.delivers.join(", ")}` : ""
        }`
    )
    .join("\n")}`;
}

export function buildPlanPrompt(input: {
  sourceText: string;
  instructions?: string;
  disciplineLine?: string;
  language: string;
  /** The rules this account keeps, already worded as positions. */
  ruleStatements: string[];
}): { system: string; user: string } {
  const system = [
    "You read a freelancer's project brief and plan the quote before it is written. You are talking to the freelancer, not to their client, so write plainly and never in the voice of a quote.",
    'Respond with ONLY valid JSON, no markdown fences, in exactly this shape: {"reading": "...", "milestones": [{"name": "...", "gate": "...", "delivers": ["..."]}], "sections": [{"key": "...", "reason": "..."}], "questions": [{"ask": "...", "assume": "..."}], "sightUnseen": boolean}.',
    '"reading" is two or three sentences saying what you take the job to be and what the client is actually buying. If the source is an email thread or notes, read the facts out of it and never repeat its sentences.',
    '"milestones" is 2 to 4 billable chunks, split where the client has to do something before the work can carry on. Give each a gate: the agreement or decision that closes it. If the source already names milestones or phases with dates, use those exactly rather than inventing your own.',
    `"sections" names the parts of the quote worth carrying, each with one short sentence saying what in THIS brief wants it. Every key must be one of: ${ALL_SECTIONS.join(
      ", "
    )}. Choose between two and five.`,
    '"questions" is at most four things you could not work out that would change the work or the price: quantities, how many people review, what already exists and in what condition, who supplies what, whether the freelancer has seen the thing being worked on. Each "ask" is one short question. Each "assume" is what you will assume if it goes unanswered, phrased as a fact rather than a sentence. Ask nothing whose answer is already in the brief, and nothing that would not move the price or the shape.',
    '"sightUnseen" is true when the brief describes a product, file, codebase or body of work the freelancer has clearly not opened.',
    '"protection" is how much this engagement needs written down. "KNOWN" only when the source shows they have worked together before, for example a reference to a previous project or an ongoing relationship. "GUARDED" when the brief carries real risk markers. "NEW" otherwise, and NEW is the right answer most of the time.',
    'Risk markers that point to GUARDED: no budget or timeline named anywhere; scope described in adjectives rather than quantities; the decision-maker is not the person writing; several stakeholders with no named owner; urgency with no reason; a product, file or codebase the freelancer has not seen; a payment arrangement the client has proposed that leaves the freelancer paid last; anything the client says about a previous freelancer.',
    '"risks" is up to three short phrases naming what you actually saw, in the freelancer\'s language and never the client\'s. Empty when the answer is KNOWN. Never guess at the client\'s character: name what is in the text.',
    "Never invent facts. If the brief does not say how big something is, that is a question rather than a number.",
    `Write everything in this language: ${input.language}.`,
  ].join(" ");

  const user = [
    input.disciplineLine ? `The freelancer: ${input.disciplineLine}` : "",
    input.ruleStatements.length
      ? `They apply these rules to every quote, so plan around them rather than proposing them:\n${input.ruleStatements
          .map((line) => `- ${line}`)
          .join("\n")}`
      : "",
    input.instructions ? `What they said about the job: ${input.instructions}` : "",
    "The brief:",
    input.sourceText.slice(0, 12000),
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}
