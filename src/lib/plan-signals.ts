/**
 * What each thing on the plan screen is, and how loudly it should say so.
 *
 * The screen was seven identical cards stacked in one column: the money the
 * client is asking for against your own rules, the open questions, the
 * sections, the reading, your settled rules. All the same width, the same
 * background, the same weight. Nothing said which of them needed an answer
 * before writing and which was there to be read, so the only way to find out
 * was to read all seven.
 *
 * Colour encodes severity rather than source, because the question somebody
 * has at this moment is "what needs me", not "who wants this". Where it came
 * from is real information too, so it is carried as an icon and a word next to
 * the title, where it can be read second.
 *
 * Kept apart from the component so the ordering can be tested without
 * rendering anything, and so the rule for what counts as a decision lives in
 * one readable place rather than in seven conditionals down a JSX tree.
 */

/** How loudly. */
export type SignalLevel =
  /** Needs an answer from you before the quote is written. */
  | "decide"
  /** Worth a look. Leaving it is a real choice with a stated consequence. */
  | "check"
  /** Already answered, shown so you can see it was. */
  | "settled";

/** Who put this here. */
export type SignalSource =
  /** The client, in the brief. */
  | "brief"
  /** Your ground rules. */
  | "rules"
  /** What you have done with this client before. */
  | "history"
  /** A choice about this job that is yours either way. */
  | "you";

export type PlanCardKey =
  | "conflicts"
  | "protection"
  | "questions"
  | "shape"
  | "milestones"
  | "sections"
  | "reading"
  | "rules";

export interface PlanCard {
  key: PlanCardKey;
  level: SignalLevel;
  source: SignalSource;
  /** Decisions on the left, things to read on the right. */
  column: "decide" | "context";
}

export interface PlanShape {
  /** Money the brief asks for that disagrees with the saved setup. */
  conflictCount: number;
  /** Whether the protection level is about to change the payment plan. */
  overridesPayment: boolean;
  /** The level proposed. */
  protection: string;
  /** Whether it came from this client's history rather than from the brief. */
  fromHistory: boolean;
  /** The brief describes something nobody has opened yet. */
  sightUnseen: boolean;
  questionCount: number;
  milestoneCount: number;
  phased: boolean;
  sectionCount: number;
  ruleCount: number;
}

const ORDER: SignalLevel[] = ["decide", "check", "settled"];

/**
 * Every card this plan needs, in the order it should be read.
 *
 * Decide first, then check, then settled, and within a level the order they
 * are declared below. A card with nothing in it is left out rather than shown
 * empty: an empty card still costs a scroll.
 */
export function planCards(shape: PlanShape): PlanCard[] {
  const cards: PlanCard[] = [];

  // The client asking for something your setup disagrees with. The sharpest
  // thing on the screen, because it is money and because the brief wins by
  // default, so silence here is a decision made for you.
  if (shape.conflictCount > 0) {
    cards.push({ key: "conflicts", level: "decide", source: "brief", column: "decide" });
  }

  // How much armour. A decision when it is about to move the money or when the
  // brief looks risky enough to have proposed the top level; otherwise it is a
  // proposal worth glancing at.
  cards.push({
    key: "protection",
    level: shape.overridesPayment || shape.protection === "GUARDED" ? "decide" : "check",
    source: shape.fromHistory ? "history" : "brief",
    column: "decide",
  });

  // Quoting something nobody has seen is the risk that ends in a rewrite, so
  // the questions are a decision in that case and a prompt otherwise.
  if (shape.questionCount > 0) {
    cards.push({
      key: "questions",
      level: shape.sightUnseen ? "decide" : "check",
      source: "brief",
      column: "decide",
    });
  }

  // Yours either way, and neither answer is wrong.
  cards.push({ key: "shape", level: "check", source: "you", column: "decide" });

  if (shape.phased && shape.milestoneCount > 0) {
    cards.push({ key: "milestones", level: "check", source: "brief", column: "decide" });
  }

  if (shape.sectionCount > 0) {
    cards.push({ key: "sections", level: "check", source: "rules", column: "decide" });
  }

  // Read, not answered. What it understood the job to be, and the positions
  // you have already taken.
  cards.push({ key: "reading", level: "settled", source: "brief", column: "context" });
  if (shape.ruleCount > 0) {
    cards.push({ key: "rules", level: "settled", source: "rules", column: "context" });
  }

  return cards.sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level));
}

/** How many things actually want an answer. Shown as a count at the top. */
export function decisionCount(cards: PlanCard[]): number {
  return cards.filter((card) => card.level === "decide").length;
}
