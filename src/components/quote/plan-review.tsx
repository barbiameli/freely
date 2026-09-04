"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
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
   * Where the brief and the saved setup disagree about money.
   *
   * Computed here rather than sent from the server so it reacts to the
   * protection level, which can change the payment plan underneath it.
   */
  const conflicts = conflictsFrom(plan.moneyAsks, money);

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

  return (
    <div className="flex flex-col gap-6">
      {/* First, because it decides what everything below it looks like. */}
      <Card tone={protection === "GUARDED" ? undefined : "quiet"}>
        <SubLabel>{t.quote.protectionTitle}</SubLabel>
        <p className="text-caption text-slate mt-1 mb-3 text-pretty">{t.quote.protectionHint}</p>
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

        {/* What this level does to the money, said rather than done.
            The top level switches the payment to stages, and it used to do
            that silently: somebody could choose "paid in full up front" two
            cards down and get a milestone schedule without ever being told
            which answer won. It is the last override in the flow that did not
            announce itself. */}
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

        {/* Why it proposed what it proposed. A level on its own is a machine
            telling somebody to be worried; a level with "no budget named, and
            the person writing is not the one deciding" is a judgement they can
            disagree with. */}
        {plan.risks.length > 0 && (
          <p className="text-caption text-text-muted mt-2 mb-0 text-pretty">
            {t.quote.protectionWhy} {plan.risks.join(". ")}.
          </p>
        )}
      </Card>

      <Card>
        <SubLabel>{t.quote.planReading}</SubLabel>
        <p className="text-small text-ink mt-1.5 mb-0 max-w-prose text-pretty leading-relaxed">
          {plan.reading}
        </p>
      </Card>

      <Card>
        <SubLabel>{t.quote.planPhases}</SubLabel>
        <p className="text-caption text-slate mt-1 mb-3 text-pretty">{t.quote.planPhasesHint}</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!phased} onClick={() => setPhased(false)}>
            {t.quote.planOnePhase}
          </Chip>
          <Chip active={phased} onClick={() => setPhased(true)}>
            {t.quote.planStages}
          </Chip>
        </div>

        {/* The second question, and only inside the first. Stages are the
            shape of the work; whether money moves at each one is separate,
            and a project can run in stages and still be paid in two lumps. */}
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
      </Card>

      {/* What the client asked for, where it differs from what you normally
          do. The brief wins, because it is the client describing the
          engagement they want and the setup is only a default. But it wins out
          loud, before anything is written, with both answers side by side. */}
      {conflicts.length > 0 && (
        <Card tone="quiet">
          <SubLabel>{t.quote.planBriefAsks}</SubLabel>
          <p className="text-caption text-slate mt-1 mb-3 max-w-prose text-pretty">
            {t.quote.planBriefAsksHint}
          </p>
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
        </Card>
      )}

      {phased && plan.milestones.length > 0 && (
        <Card>
          <SubLabel>{t.quote.planMilestones}</SubLabel>
          <p className="text-caption text-slate mt-1 mb-3 text-pretty">{t.quote.planMilestonesHint}</p>
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
        </Card>
      )}

      {/* Asked rather than assumed, because these are the answers that move
          the price. Skipping one is fine and says so: it becomes a written
          assumption on the quote instead of a silent guess. */}
      {plan.questions.length > 0 && (
        <Card tone={plan.sightUnseen ? undefined : "quiet"}>
          <SubLabel>{t.quote.planQuestions}</SubLabel>
          <p className="text-caption text-slate mt-1 mb-3 max-w-prose text-pretty">
            {plan.sightUnseen ? t.quote.planSightUnseen : t.quote.planQuestionsHint}
          </p>
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
                  className="w-full bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
                />
                {question.assume && !answers[index]?.trim() && (
                  <p className="text-caption text-text-muted mt-1 mb-0 text-pretty">
                    {t.quote.planAssume.replace("{assume}", question.assume)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SubLabel>{t.quote.planSections}</SubLabel>
        <p className="text-caption text-slate mt-1 mb-3 text-pretty">{t.quote.planSectionsHint}</p>
        <div className="flex flex-col gap-2.5">
          {/* Everything the quote will carry, whatever put it there. The list
              showed only what the plan proposed, so sections added by the
              protection level were applied invisibly and could not be
              unticked. A choice you cannot see is not a choice. */}
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
      </Card>

      {/* Settled, not proposed. These are already the freelancer's own
          positions, so they are stated here rather than offered back as
          choices, and the link is the way to change one. */}
      {plan.rules.length > 0 && (
        <Card tone="quiet">
          <SubLabel>{t.quote.planRules}</SubLabel>
          <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-1.5">
            {plan.rules.map((rule) => (
              <li key={rule.key} className="text-caption text-slate text-pretty">
                {rule.statement}
              </li>
            ))}
          </ul>
        </Card>
      )}

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
