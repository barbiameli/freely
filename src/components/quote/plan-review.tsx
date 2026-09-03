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
import type { SectionKey } from "@/lib/quote-defaults";
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
export function PlanReview({
  plan,
  sectionName,
  onWrite,
  onBack,
  working,
}: {
  plan: PlannedQuote;
  /** The dictionary lookup for a section key, owned by the wizard. */
  sectionName: (key: SectionKey, t: Dictionary) => string;
  onWrite: (choices: {
    sections: SectionKey[];
    milestones: string[];
    answers: PlanAnswer[];
    protection: ProtectionLevel;
    /** Whether the stages are payment points, or only the shape of the work. */
    milestonesBillable: boolean;
  }) => void;
  onBack: () => void;
  working: boolean;
}) {
  const t = useT();
  const [sections, setSections] = useState<SectionKey[]>(
    () => plan.sections.map((s) => s.key as SectionKey)
  );
  const [milestones, setMilestones] = useState<string[]>(
    () => plan.milestones.map((m) => m.name)
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
  const [billable, setBillable] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /**
   * How much armour this quote carries.
   *
   * Asked first, because it changes everything under it: which sections the
   * quote needs and, at the top level, how the money is split. The proposal
   * comes from the brief and the reasons are shown next to it, so agreeing is
   * a decision rather than a default.
   */
  const [protection, setProtection] = useState<ProtectionLevel>(plan.protection);

  function chooseProtection(level: ProtectionLevel) {
    setProtection(level);
    // The level decides the sections, so choosing one replaces whatever the
    // last choice put there rather than adding to it. Anything the plan
    // proposed on top of the level survives, since that came from the brief.
    const wanted = protectionFor(level).sections;
    setSections(() => {
      const fromPlan = plan.sections
        .map((s) => s.key as SectionKey)
        .filter((key) => wanted.includes(key));
      return Array.from(new Set([...wanted, ...fromPlan]));
    });
  }

  const chosen = protectionFor(protection);

  function toggleSection(key: SectionKey) {
    setSections((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  }

  function toggleMilestone(name: string) {
    setMilestones((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name]
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

      {plan.milestones.length > 0 && (
        <Card>
          <SubLabel>{t.quote.planMilestones}</SubLabel>
          <p className="text-caption text-slate mt-1 mb-3 text-pretty">{t.quote.planMilestonesHint}</p>

          {/* Two questions, not one. */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <Chip active={!billable} onClick={() => setBillable(false)}>
              {t.quote.planStagesShape}
            </Chip>
            <Chip active={billable} onClick={() => setBillable(true)}>
              {t.quote.planStagesBillable}
            </Chip>
          </div>
          <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
            {plan.milestones.map((milestone) => {
              const on = milestones.includes(milestone.name);
              return (
                <li key={milestone.name}>
                  <button
                    type="button"
                    onClick={() => toggleMilestone(milestone.name)}
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
            {plan.questions.map((question) => (
              <div key={question.ask}>
                <label className="block font-body font-semibold text-small text-ink mb-1.5 text-pretty">
                  {question.ask}
                </label>
                <input
                  type="text"
                  value={answers[question.ask] ?? ""}
                  onChange={(e) =>
                    setAnswers((current) => ({ ...current, [question.ask]: e.target.value }))
                  }
                  placeholder={t.quote.planSkip}
                  className="w-full bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
                />
                {question.assume && !answers[question.ask]?.trim() && (
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
          {plan.sections.map((section) => {
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
              answers: Object.entries(answers)
                .filter(([, value]) => value.trim())
                .map(([ask, answer]) => ({ ask, answer })),
              protection,
              milestonesBillable: billable,
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
