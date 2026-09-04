"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubLabel } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { useT } from "@/lib/i18n/context";
import type { PlannedQuote } from "@/actions/plan";
import type { PlanAnswer } from "@/lib/quote-plan";
import {
  conflictsFrom,
  type MoneyConflict,
  type MoneyState,
  type MoneyTopic,
} from "@/lib/money-asks";
import { ALL_SECTIONS, type SectionKey } from "@/lib/quote-defaults";
import {
  PROTECTION_LEVELS,
  protectionFor,
  type ProtectionLevel,
} from "@/lib/protection";
import type { Dictionary } from "@/lib/i18n";
import { SignalCard } from "@/components/quote/signal-card";
import { decisionCount, planCards, type PlanCardKey } from "@/lib/plan-signals";

/**
 * What Freely is about to write, before it writes it.
 *
 * The step that used not to exist. Pressing Generate spent the expensive call
 * straight away and handed back a finished document, so a misreading of the
 * brief, which on a pasted email thread is common, could only be corrected by
 * generating the whole thing again. The reading is now cheap, first, and
 * yours to correct.
 *
 * Deliberately not a draft. Nothing here is written in the quote's voice and
 * none of it is client-facing: a half-written quote invites editing prose,
 * and the thing worth fixing at this point is the understanding underneath it.
 *
 * Four things, in the order they matter: what it took the job to be, how it
 * would split the money, what it could not work out, and what the quote will
 * carry. The rules sit at the bottom as a statement of what is already
 * settled, because they are not a decision to make here.
 */
/** What a money question is called, in the reader's language. */
function moneyLabel(topic: MoneyTopic, t: Dictionary): string {
  if (topic === "rateUnit") return t.quote.moneyRateUnit;
  if (topic === "billing") return t.quote.moneyBilling;
  if (topic === "paymentPlan") return t.quote.moneyPaymentPlan;
  return t.quote.moneyDeposit;
}

/** One of the app's own values, said in words rather than in caps. */
function moneyValue(value: string, t: Dictionary): string {
  const words: Record<string, string> = {
    FIXED: t.quote.rateFixed,
    HOUR: t.quote.perHour,
    DAY: t.quote.perDay,
    FIXED_TOTAL: t.quote.billingFixed,
    HOURLY_TRACKED: t.quote.billingTracked,
    UPFRONT: t.quote.paymentUpfront,
    SPLIT: t.quote.paymentSplit,
    ON_DELIVERY: t.quote.paymentOnDelivery,
    MILESTONE: t.quote.paymentMilestone,
  };
  return words[value] ?? `${value}%`;
}

/** Why a section is here when the level rather than the brief put it there. */
function protectionReason(level: ProtectionLevel, t: Dictionary): string {
  return level === "KNOWN"
    ? t.quote.protectionKnown
    : level === "NEW"
    ? t.quote.protectionNew
    : t.quote.protectionGuarded;
}

export function PlanReview({
  plan,
  sectionName,
  onWrite,
  onBack,
  working,
  money,
  defaultBillable = false,
}: {
  plan: PlannedQuote;
  /** The dictionary lookup for a section key, owned by the wizard. */
  sectionName: (key: SectionKey, t: Dictionary) => string;
  onWrite: (choices: {
    sections: SectionKey[];
    milestones: number[];
    answers: PlanAnswer[];
    protection: ProtectionLevel;
    /** Whether the stages are payment points, or only the shape of the work. */
    milestonesBillable: boolean;
    /** Whether the work runs in stages at all. */
    phased: boolean;
    /** The money questions where the brief is to be followed. */
    followBrief: MoneyTopic[];
    conflicts: MoneyConflict[];
  }) => void;
  onBack: () => void;
  working: boolean;
  /** The money the draft has already decided, for comparing against the brief. */
  money: MoneyState;
  /**
   * Whether the stages start as payment points.
   *
   * False in general, because billing per stage is a commitment and a
   * commitment nobody made should not be the assumption. True when their saved
   * plan already says milestone billing, since otherwise the quote said "these
   * are the stages, payment follows the terms below" while the terms said
   * payment is per stage.
   */
  defaultBillable?: boolean;
}) {
  const t = useT();
  const [sections, setSections] = useState<SectionKey[]>(
    () => plan.sections.map((s) => s.key as SectionKey)
  );
  // Kept by position, since a model can name two stages the same and keeping
  // one by name would keep or drop both.
  const [milestones, setMilestones] = useState<number[]>(() =>
    plan.milestones.map((_, index) => index)
  );
  /**
   * Whether the stages are where money moves.
   *
   * Kept apart from the stages themselves, because they are two questions and
   * were one. Plenty of projects run in stages and are still paid in two lumps
   * at either end, and putting an amount on every stage of one of those
   * invents a payment schedule nobody agreed to.
   *
   * Off by default: billing per stage is a commitment, and a commitment
   * nobody made should not be the assumption.
   */
  const [billable, setBillable] = useState(defaultBillable);
  /**
   * One phase, or stages.
   *
   * Always asked, whatever the brief says and whatever the account's default
   * is, because it is a question about how this job runs rather than a
   * preference: the same freelancer does both, and the answer changes the
   * document more than anything else on this screen.
   */
  const [phased, setPhased] = useState(plan.milestones.length > 1);
  /**
   * Where the brief and the saved setup disagree about money.
   *
   * Computed here rather than sent from the server so it reacts to the
   * protection level, which can change the payment plan underneath it.
   *
   * Declared above the state that seeds itself from it, and that is the whole
   * point rather than tidiness. It used to sit forty lines lower, and the
   * lazy initialiser below runs during the first render, so it reached this
   * const while it was still in the temporal dead zone and threw "Cannot
   * access 'D' before initialization" against the production bundle, D being
   * the minified name. Every quote died at the plan step. TypeScript compiles
   * it, the tests pass, the build succeeds, and only a browser ever sees it.
   */
  const conflicts = conflictsFrom(plan.moneyAsks, money);

  /** Conflicts where the freelancer chose to follow the brief. */
  const [followBrief, setFollowBrief] = useState<MoneyTopic[]>(() =>
    conflicts.map((conflict) => conflict.topic)
  );
  /** Keyed on position, since two questions can read identically. */
  const [answers, setAnswers] = useState<Record<number, string>>({});
  /**
   * How much armour this quote carries.
   *
   * Asked first, because it changes everything under it: which sections the
   * quote needs and, at the top level, how the money is split. The proposal
   * comes from the brief and the reasons are shown next to it, so agreeing is
   * a decision rather than a default.
   */
  const [protection, setProtection] = useState<ProtectionLevel>(plan.protection);

  /**
   * Changing the level moves the sections it is responsible for, and nothing
   * else.
   *
   * It used to rebuild the whole list from the new level, which threw away
   * anything ticked or unticked by hand and applied sections that were never
   * shown in the list below, so a quote could carry a section its author had
   * neither seen nor chosen. Now it removes what the old level brought,
   * adds what the new one brings, and leaves every other decision alone.
   */
  function chooseProtection(level: ProtectionLevel) {
    const before = protectionFor(protection).sections;
    const after = protectionFor(level).sections;
    setProtection(level);
    setSections((current) => {
      const kept = current.filter((key) => !before.includes(key) || after.includes(key));
      return Array.from(new Set([...kept, ...after]));
    });
  }

  const chosen = protectionFor(protection);

  /**
   * Whether the protection level is about to beat the payment answer.
   *
   * Only when it actually differs: saying "this changes your payment to
   * stages" to somebody who already chose stages is noise.
   */
  const overridesPayment = Boolean(
    chosen.paymentPlan && chosen.paymentPlan !== money.paymentPlan
  );

  /**
   * The sections to show: the ones the plan proposed, plus anything on that it
   * did not, in the app's own order.
   */
  const listedSections = (() => {
    const byKey = new Map(plan.sections.map((section) => [section.key, section]));
    for (const key of sections) {
      if (!byKey.has(key)) {
        byKey.set(key, { key, reason: protectionReason(protection, t) });
      }
    }
    return ALL_SECTIONS.filter((key) => byKey.has(key)).map((key) => byKey.get(key)!);
  })();

  function toggleSection(key: SectionKey) {
    setSections((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  }

  function toggleMilestone(index: number) {
    setMilestones((current) =>
      current.includes(index) ? current.filter((n) => n !== index) : [...current, index]
    );
  }

  /**
   * What is on this screen, and how loudly each thing says so.
   *
   * The screen used to be seven identical cards in one column, so the money
   * the client is asking for against your own rules looked exactly like the
   * list of sections. See lib/plan-signals for what decides the level.
   */
  const cards = planCards({
    conflictCount: conflicts.length,
    overridesPayment,
    protection,
    fromHistory: plan.history?.quotes ? plan.history.quotes > 0 : false,
    sightUnseen: plan.sightUnseen,
    questionCount: plan.questions.length,
    milestoneCount: plan.milestones.length,
    phased,
    sectionCount: listedSections.length,
    ruleCount: plan.rules.length,
  });
  const needing = decisionCount(cards);

  const bodies: Record<PlanCardKey, { title: string; hint?: string; node: React.ReactNode }> = {
    conflicts: {
      title: t.quote.planBriefAsks,
      hint: t.quote.planBriefAsksHint,
      node: (
        <div className="flex flex-col gap-3">
          {conflicts.map((conflict) => {
            const following = followBrief.includes(conflict.topic);
            return (
              <div key={conflict.topic}>
                <div className="font-body font-semibold text-small text-ink text-pretty">
                  {moneyLabel(conflict.topic, t)}
                </div>
                {conflict.quote && (
                  <p className="text-caption text-slate mt-0.5 mb-0 text-pretty">
                    {t.quote.planBriefSays.replace("{quote}", conflict.quote)}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Chip
                    active={following}
                    onClick={() =>
                      setFollowBrief((all) =>
                        all.includes(conflict.topic) ? all : [...all, conflict.topic]
                      )
                    }
                  >
                    {t.quote.planUseBrief.replace("{value}", moneyValue(conflict.theirs, t))}
                  </Chip>
                  <Chip
                    active={!following}
                    onClick={() =>
                      setFollowBrief((all) => all.filter((topic) => topic !== conflict.topic))
                    }
                  >
                    {t.quote.planKeepMine.replace("{value}", moneyValue(conflict.yours, t))}
                  </Chip>
                </div>
              </div>
            );
          })}
        </div>
      ),
    },

    protection: {
      title: t.quote.protectionTitle,
      hint: t.quote.protectionHint,
      node: (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PROTECTION_LEVELS.map((level) => (
              <Chip
                key={level}
                active={protection === level}
                onClick={() => chooseProtection(level)}
              >
                {level === "KNOWN"
                  ? t.quote.protectionKnown
                  : level === "NEW"
                    ? t.quote.protectionNew
                    : t.quote.protectionGuarded}
              </Chip>
            ))}
          </div>
          <p className="text-caption text-slate mt-3 mb-0 max-w-prose text-pretty">
            {protection === "KNOWN"
              ? t.quote.protectionKnownWhat
              : protection === "NEW"
                ? t.quote.protectionNewWhat
                : t.quote.protectionGuardedWhat}
            {protection === "GUARDED" && chosen.paidDiscovery && plan.sightUnseen
              ? ` ${t.quote.protectionGuardedDiscovery}`
              : ""}
          </p>

          {/* What this level does to the money, said rather than done. */}
          {overridesPayment && (
            <p className="text-caption text-ink mt-3 mb-0 max-w-prose text-pretty">
              <span className="font-body font-semibold">
                {t.quote.protectionChangesPayment
                  .replace("{from}", moneyValue(money.paymentPlan, t))
                  .replace("{to}", moneyValue(chosen.paymentPlan ?? "MILESTONE", t))}
              </span>{" "}
              {t.quote.protectionChangesWhy}
            </p>
          )}

          {plan.risks.length > 0 && (
            <p className="text-caption text-text-muted mt-2 mb-0 text-pretty">
              {t.quote.protectionWhy} {plan.risks.join(". ")}.
            </p>
          )}
        </>
      ),
    },

    questions: {
      title: t.quote.planQuestions,
      hint: plan.sightUnseen ? t.quote.planSightUnseen : t.quote.planQuestionsHint,
      node: (
        <div className="flex flex-col gap-4">
          {plan.questions.map((question, index) => (
            <div key={index}>
              <label className="block font-body font-semibold text-small text-ink mb-1.5 text-pretty">
                {question.ask}
              </label>
              <input
                type="text"
                value={answers[index] ?? ""}
                onChange={(e) =>
                  setAnswers((current) => ({ ...current, [index]: e.target.value }))
                }
                placeholder={t.quote.planSkip}
                className="w-full bg-white rounded-lg border border-line px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
              />
              {question.assume && !answers[index]?.trim() && (
                <p className="text-caption text-text-muted mt-1 mb-0 text-pretty">
                  {t.quote.planAssume.replace("{assume}", question.assume)}
                </p>
              )}
            </div>
          ))}
        </div>
      ),
    },

    shape: {
      title: t.quote.planPhases,
      hint: t.quote.planPhasesHint,
      node: (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!phased} onClick={() => setPhased(false)}>
              {t.quote.planOnePhase}
            </Chip>
            <Chip active={phased} onClick={() => setPhased(true)}>
              {t.quote.planStages}
            </Chip>
          </div>

          {/* The second question, and only inside the first. */}
          {phased && (
            <div className="mt-4">
              <SubLabel>{t.quote.planStagesFor}</SubLabel>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <Chip active={!billable} onClick={() => setBillable(false)}>
                  {t.quote.planStagesShape}
                </Chip>
                <Chip active={billable} onClick={() => setBillable(true)}>
                  {t.quote.planStagesBillable}
                </Chip>
              </div>
            </div>
          )}
        </>
      ),
    },

    milestones: {
      title: t.quote.planMilestones,
      hint: t.quote.planMilestonesHint,
      node: (
        <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
          {plan.milestones.map((milestone, index) => {
            const on = milestones.includes(index);
            return (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => toggleMilestone(index)}
                  aria-pressed={on}
                  className="w-full flex items-start gap-2.5 text-left bg-none border-none cursor-pointer p-0 tap-row"
                >
                  <span
                    className={`mt-[2px] w-[15px] h-[15px] rounded border shrink-0 flex items-center justify-center transition-colors ${
                      on ? "bg-violet border-violet" : "bg-white border-line"
                    }`}
                  >
                    {on && <Check size={10} strokeWidth={3.5} className="text-white" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-body font-semibold text-small text-ink">
                      {milestone.name}
                    </span>
                    {milestone.gate && (
                      <span className="block text-caption text-slate mt-0.5 text-pretty">
                        {t.quote.planGate.replace("{gate}", milestone.gate)}
                      </span>
                    )}
                    {milestone.delivers.length > 0 && (
                      <span className="block text-caption text-text-muted mt-0.5 text-pretty">
                        {milestone.delivers.join(", ")}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ),
    },

    sections: {
      title: t.quote.planSections,
      hint: t.quote.planSectionsHint,
      node: (
        <div className="flex flex-col gap-2.5">
          {listedSections.map((section) => {
            const key = section.key as SectionKey;
            const on = sections.includes(key);
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => toggleSection(key)}
                aria-pressed={on}
                className="w-full flex items-start gap-2.5 text-left bg-none border-none cursor-pointer p-0 tap-row"
              >
                <span
                  className={`mt-[2px] w-[15px] h-[15px] rounded border shrink-0 flex items-center justify-center transition-colors ${
                    on ? "bg-violet border-violet" : "bg-white border-line"
                  }`}
                >
                  {on && <Check size={10} strokeWidth={3.5} className="text-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-body font-semibold text-small text-ink">
                    {sectionName(key, t)}
                  </span>
                  <span className="block text-caption text-slate mt-0.5 text-pretty">
                    {section.reason}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ),
    },

    reading: {
      title: t.quote.planReading,
      node: (
        <p className="text-small text-ink m-0 max-w-prose text-pretty leading-relaxed">
          {plan.reading}
        </p>
      ),
    },

    rules: {
      title: t.quote.planRules,
      node: (
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {plan.rules.map((rule) => (
            <li key={rule.key} className="text-caption text-slate text-pretty">
              {rule.statement}
            </li>
          ))}
        </ul>
      ),
    },
  };

  function render(column: "decide" | "context") {
    return cards
      .filter((card) => card.column === column)
      .map((card) => {
        const body = bodies[card.key];
        return (
          <SignalCard
            key={card.key}
            level={card.level}
            source={card.source}
            title={body.title}
            hint={body.hint}
            t={t}
          >
            {body.node}
          </SignalCard>
        );
      });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* The one number worth reading before anything else. */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`w-[9px] h-[9px] rounded-full shrink-0 ${needing > 0 ? "bg-coral" : "bg-success"}`}
          aria-hidden
        />
        <p className="font-body font-semibold text-small text-ink m-0">
          {needing === 0
            ? t.quote.planNothingPending
            : needing === 1
              ? t.quote.planNeedsYouOne
              : t.quote.planNeedsYou.replace("{count}", String(needing))}
        </p>
      </div>

      {/* Two columns so seven cards are not seven screens. Decisions on the
          left in the order they matter, what it read on the right, where it
          can be checked against without being scrolled past. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-5 items-start">
        <div className="flex flex-col gap-4 min-w-0">{render("decide")}</div>
        <div className="flex flex-col gap-4 min-w-0 lg:sticky lg:top-4">{render("context")}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          icon={ArrowRight}
          loading={working}
          onClick={() =>
            onWrite({
              sections,
              milestones,
              answers: plan.questions
                .map((question, index) => ({
                  index,
                  ask: question.ask,
                  answer: answers[index] ?? "",
                }))
                .filter((entry) => entry.answer.trim()),
              protection,
              milestonesBillable: phased && billable,
              phased,
              followBrief,
              conflicts,
            })
          }
        >
          {t.quote.planWrite}
        </Button>
        <button
          type="button"
          onClick={onBack}
          disabled={working}
          className="text-meta font-semibold text-slate bg-none border-none cursor-pointer p-0 tap disabled:opacity-60"
        >
          {t.quote.planBack}
        </button>
      </div>
    </div>
  );
}
