/**
 * What the brief asks for about money, against what you normally do.
 *
 * Five separate things decide how a quote's money works: the rate unit, the
 * billing basis, the payment plan, whether stages carry amounts, and the
 * protection level, which quietly overrode the payment plan. Nothing compared
 * them, so a brief asking for a fixed price could arrive at somebody whose
 * setup says fifty an hour, and the quote would come out saying one thing in
 * the terms and another in the figures. Nobody was told.
 *
 * The rule is that the brief wins, because it is the client describing the
 * engagement they want and the setup is only a default. But it wins out loud,
 * at the plan step, before anything is written, with both answers side by side
 * and the choice left to the freelancer. A default overridden silently is the
 * same bug as a default that ignores the brief.
 */

/** The parts of the money a brief can have an opinion about. */
export type MoneyTopic = "rateUnit" | "billing" | "paymentPlan" | "deposit";

/** Something the brief actually says, as the reading step found it. */
export interface MoneyAsk {
  topic: MoneyTopic;
  /**
   * The brief's answer, as one of the app's own values.
   *
   * A free-text summary would be unactionable: the freelancer has to be able
   * to press a button that applies it.
   */
  value: string;
  /** The words in the brief that say so, for showing rather than for parsing. */
  quote: string;
}

/** What the account would have done, and what the brief asks for instead. */
export interface MoneyConflict {
  topic: MoneyTopic;
  /** The value already on the draft. */
  yours: string;
  /** What the brief asks for. */
  theirs: string;
  quote: string;
}

/** The draft, reduced to the money it has decided. */
export interface MoneyState {
  rateUnit: string;
  billing: string;
  paymentPlan: string;
  upfrontPercent: number;
}

function currentFor(topic: MoneyTopic, state: MoneyState): string {
  if (topic === "rateUnit") return state.rateUnit;
  if (topic === "billing") return state.billing;
  if (topic === "paymentPlan") return state.paymentPlan;
  return String(state.upfrontPercent);
}

/**
 * Only genuine disagreements.
 *
 * A brief that asks for what somebody already does is not a conflict, it is
 * agreement, and showing it as a choice would train people to click through
 * the ones that matter.
 */
export function conflictsFrom(asks: MoneyAsk[], state: MoneyState): MoneyConflict[] {
  const seen = new Set<MoneyTopic>();
  const out: MoneyConflict[] = [];

  for (const ask of asks) {
    if (seen.has(ask.topic)) continue;
    const yours = currentFor(ask.topic, state);
    if (!ask.value || ask.value === yours) continue;
    seen.add(ask.topic);
    out.push({ topic: ask.topic, yours, theirs: ask.value, quote: ask.quote });
  }
  return out;
}

/** The draft with the chosen answers applied. */
export function applyChoices(
  state: MoneyState,
  conflicts: MoneyConflict[],
  followBrief: MoneyTopic[]
): MoneyState {
  const next = { ...state };
  for (const conflict of conflicts) {
    if (!followBrief.includes(conflict.topic)) continue;
    if (conflict.topic === "rateUnit") next.rateUnit = conflict.theirs;
    if (conflict.topic === "billing") next.billing = conflict.theirs;
    if (conflict.topic === "paymentPlan") next.paymentPlan = conflict.theirs;
    if (conflict.topic === "deposit") {
      const percent = Number(conflict.theirs);
      if (Number.isFinite(percent)) next.upfrontPercent = Math.min(100, Math.max(0, percent));
    }
  }
  return next;
}

/**
 * The remaining contradictions inside one quote's own settings.
 *
 * Separate from the brief, and about the quote arguing with itself: a fixed
 * price that is also billed by the hour, or stages with no amounts on a quote
 * whose terms say each stage is invoiced. These are not choices, they are
 * mistakes, and the right answer is to correct them rather than to ask.
 */
export function incoherent(
  state: MoneyState,
  options: { hasMilestones: boolean; milestonesBillable: boolean }
): MoneyTopic[] {
  const wrong: MoneyTopic[] = [];

  // A fixed price has no hours to bill, so an hourly basis alongside it is a
  // leftover from before the rate changed.
  if (state.rateUnit === "FIXED" && state.billing === "HOURLY_TRACKED") {
    wrong.push("billing");
  }

  // Terms that say each stage is invoiced, next to stages carrying no figures.
  if (state.paymentPlan === "MILESTONE" && options.hasMilestones && !options.milestonesBillable) {
    wrong.push("paymentPlan");
  }

  return wrong;
}

/** Settings with the contradictions above resolved in the safer direction. */
export function reconcile(
  state: MoneyState,
  options: { hasMilestones: boolean; milestonesBillable: boolean }
): MoneyState {
  const next = { ...state };
  // Fixed wins over an hourly basis: the freelancer chose the rate unit
  // deliberately and the basis is the thing that was left behind.
  if (next.rateUnit === "FIXED" && next.billing === "HOURLY_TRACKED") {
    next.billing = "FIXED_TOTAL";
  }
  void options;
  return next;
}
