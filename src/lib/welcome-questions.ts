/**
 * The questions behind a welcome pack.
 *
 * Short on purpose. The thing being produced is a paragraph a client reads
 * once before a project starts, and a form with fourteen fields produces
 * either nothing or a document nobody finishes. Five questions, each with the
 * answers most freelancers actually give as chips, and a box for the ones who
 * want to say it their own way.
 *
 * Answers are free text in the end, chips or not: a chip is a fast way to type
 * a common answer, not a closed list. "Two rounds" and "as many as it takes"
 * are both real ways to work.
 */
export interface WelcomeQuestion {
  id: string;
  /** Asked the way a person would ask it, out loud. */
  ask: string;
  /** Why a client cares, shown small. Keeps this from reading as paperwork. */
  why: string;
  chips: string[];
}

export const WELCOME_QUESTIONS: WelcomeQuestion[] = [
  {
    id: "revisions",
    ask: "How many rounds of changes are included?",
    why: "The single commonest thing to fall out over, six weeks in.",
    chips: ["Two rounds", "Three rounds", "As many as it takes", "One round per stage"],
  },
  {
    id: "feedback",
    ask: "How quickly do you need feedback back?",
    why: "Says what happens to the date when it does not arrive.",
    chips: ["Within 2 working days", "Within a week", "Whenever suits you"],
  },
  {
    id: "hours",
    ask: "When are you working?",
    why: "Stops a Sunday message reading as being ignored.",
    chips: ["Weekdays, 9 to 6", "Weekdays, mornings", "Flexible, I reply within a day"],
  },
  {
    id: "reach",
    ask: "Where should they reach you?",
    why: "One place, so nothing lands somewhere you do not look.",
    chips: ["Email", "Email, and a call for anything big", "Slack", "WhatsApp"],
  },
  {
    id: "need",
    ask: "What do you need from them to start?",
    why: "The thing that holds up week one, every time.",
    chips: ["Brand files and logins", "Copy and images", "One person to sign things off"],
  },
];

/** Only answers to questions that exist, trimmed, capped. */
export function cleanAnswers(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const question of WELCOME_QUESTIONS) {
    const value = source[question.id];
    if (typeof value !== "string") continue;
    const cleaned = value.trim().slice(0, 300);
    if (cleaned) out[question.id] = cleaned;
  }
  return out;
}

/** How far through somebody is, for the progress line on the builder. */
export function answeredCount(answers: Record<string, string>): number {
  return WELCOME_QUESTIONS.filter((q) => answers[q.id]).length;
}
