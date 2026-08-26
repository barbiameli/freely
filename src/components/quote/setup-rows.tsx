"use client";

import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Check, RotateCcw, Search } from "lucide-react";
import clsx from "@/lib/clsx";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { SubLabel } from "@/components/ui/label";
import { CURRENCIES, currencySymbol } from "@/lib/currencies";
import { COUNTRIES, currencyForCountry } from "@/lib/countries";
import { rateSuffix, type RateUnit } from "@/lib/rate-unit";
import { TemplatePreview } from "@/components/quote/template-preview";
import { SECTION_QUESTIONS, type SectionNotes } from "@/lib/quote-prompts";
import {
  ALL_SECTIONS,
  WIZARD_ROWS,
  changedRows,
  decidedRows,
  describeRow,
  resolveSetup,
  type AccountDefaults,
  type QuoteSetup,
  type SectionKey,
  type SetupRowKey,
  type SetupWords,
} from "@/lib/quote-defaults";
import { useT } from "@/lib/i18n/context";
import type { Dictionary } from "@/lib/i18n";
import type { QuoteDraftPayload } from "@/actions/briefs";
import { researchRateAction, type ResearchedRate } from "@/actions/rate";

/**
 * The quote setup, as four readable lines.
 *
 * This replaced most of a two-screen wizard. Fourteen fields were being filled
 * in on every quote and about four of them were about the job; the rest were
 * about the freelancer, and are remembered now (see lib/quote-defaults).
 *
 * The shape is deliberate in three ways.
 *
 * Every value is stated in words on the closed row. The failure of remembered
 * settings is sending last month's terms without noticing, and a row that only
 * says "Sections" prevents nothing. "Strategy, Timeline and Statement of work"
 * is read in two seconds without opening anything.
 *
 * A row opens into the real controls rather than a copy of them, so there is
 * one place each of these is edited.
 *
 * And a row that differs from the usual says so, says what the usual is, and
 * offers both ways out. Without that, one oddly-priced job either rewrites the
 * setup for every quote after it or leaves no way to say "actually, keep this".
 *
 * Every row starts closed, including on a first quote. Four closed lines are a
 * summary; four open ones are the form this replaced. The one exception is a
 * generate refused for want of a rate, where the message would otherwise point
 * at a control nobody can see.
 */
export function SetupRows({
  draft,
  setDraft,
  sectionNotes,
  setSectionNotes,
  availabilityNote,
  setAvailabilityNote,
  saved,
  hasBrand,
  rateHelpOpen,
  setRateHelpOpen,
  onKeep,
  keptRows,
  brandUpload,
  pricedFor,
  savedCountry,
  problemRow,
  problemMessage,
}: {
  draft: QuoteDraftPayload;
  setDraft: Dispatch<SetStateAction<QuoteDraftPayload>>;
  sectionNotes: SectionNotes;
  setSectionNotes: Dispatch<SetStateAction<SectionNotes>>;
  availabilityNote: string;
  setAvailabilityNote: Dispatch<SetStateAction<string>>;
  /** The account's saved usuals, for deciding what is a change and what is
   * simply the answer. */
  saved: AccountDefaults;
  hasBrand?: boolean;
  /** The rate helper, held by the wizard because it also clears the rate. */
  rateHelpOpen: boolean;
  setRateHelpOpen: (open: boolean) => void;
  /** "Make this my usual", per row. */
  onKeep: (row: SetupRowKey) => void;
  /** Rows already kept in this session, so the offer is not made twice. */
  keptRows: SetupRowKey[];
  /** The brand upload panel, which lives in the wizard with its handlers. */
  brandUpload?: ReactNode;
  /** The market questions, shown under the rate when there is no rate. */
  pricedFor?: ReactNode;
  /** The country already on the account, so the rate helper does not ask
   * for something Memory already knows. */
  savedCountry?: string | null;
  /** A row that is missing something, and what to say about it.
   *
   * Shown inside the row rather than at the foot of the form. A message by the
   * button saying "add your rate" is pointing at a control that may be three
   * rows up and closed, which is a message that names a problem and hides it. */
  problemRow?: SetupRowKey | null;
  problemMessage?: string;
}) {
  const t = useT();
  const decided = decidedRows(saved);
  const setup = setupFromDraft(draft, sectionNotes, availabilityNote);
  const changed = changedRows(setup, saved);
  const usual = resolveSetup(saved);
  const words = setupWords(t);
  const symbol = currencySymbol(draft.currency);

  // One at a time, starting on the first thing nobody has answered.
  //
  // Every undecided row used to open at once, so a first quote arrived as four
  // expanded panels of controls, which is the form this card replaced. One
  // open row is a question; four are a wall.
  //
  // A closed row still states its value where there is one, and says "Choose"
  // where there is not, so nothing is hidden. It just is not all shouting at
  // once. Memory's copy of this card already worked this way, so the two now
  // behave alike as well as looking alike.
  const [open, setOpen] = useState<SetupRowKey | null>(
    () => WIZARD_ROWS.find((row) => !decided.includes(row)) ?? null
  );

  // Except when generating was refused for want of a rate. The message would
  // otherwise point at a control inside a closed row.
  useEffect(() => {
    if (rateHelpOpen) setOpen("rate");
  }, [rateHelpOpen]);

  // And when something required is missing, the row holding it comes forward.
  useEffect(() => {
    if (problemRow) setOpen(problemRow);
  }, [problemRow]);

  function toggle(row: SetupRowKey) {
    setOpen((current) => (current === row ? null : row));
  }

  function putBack(row: SetupRowKey) {
    setDraft((d) => {
      switch (row) {
        case "rate":
          return { ...d, hourlyRate: usual.rate, rateUnit: usual.rateUnit };
        case "payment":
          return { ...d, paymentPlan: usual.paymentPlan, upfrontPercent: usual.upfrontPercent };
        case "sections":
          return { ...d, ...sectionFlags(usual.sections) };
        case "presentation":
          return {
            ...d,
            format: usual.format,
            template: usual.template,
            branding: usual.branding,
          };
      }
    });
  }

  const anyDecided = decided.length > 0;

  return (
    <div className="bg-white border border-line rounded-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <div className="font-body font-bold text-body text-ink">
            {anyDecided ? t.quote.setupTitle : t.quote.setupFirstTitle}
          </div>
          <p className="text-caption text-slate mt-0.5 mb-0">
            {anyDecided ? t.quote.setupRemembered : t.quote.setupFirstHint}
          </p>
        </div>
        {/* Memory, reachable without abandoning the brief already pasted in.
            A new tab rather than a navigation for exactly that reason. */}
        <Link
          href="/memory#quotes"
          target="_blank"
          className="shrink-0 text-caption text-slate hover:text-ink no-underline tap"
        >
          {t.quote.setupEditInMemory}
        </Link>
      </div>

      {WIZARD_ROWS.map((row) => {
        const isOpen = open === row;
        const hasProblem = problemRow === row;
        const isChanged = changed.includes(row);
        const kept = keptRows.includes(row);
        return (
          <div
            key={row}
            className={clsx(
              "border-t border-line transition-colors",
              // A tone rather than another rule. Hairlines alone gave every row
              // the same weight whether it was open or shut, so an expanded
              // panel read as loose controls between two lines instead of as
              // one block. Faint on purpose: enough to group, not enough to
              // shout.
              isOpen && "bg-paper",
              hasProblem && "bg-overdue-tint"
            )}
          >
            <button
              type="button"
              onClick={() => toggle(row)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 text-left bg-none border-none cursor-pointer px-5 py-4 hover:bg-paper transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0 shrink-0">
                {/* The open row is the heading of what is below it, so it is
                    weighted like one. Closed rows stay quiet: four bold labels
                    in a column is a list with no hierarchy at all. */}
                <span
                  className={
                    isOpen
                      ? "font-body font-bold text-body text-ink"
                      : "font-body text-small text-slate"
                  }
                >
                  {rowLabel(row, t)}
                </span>
                {hasProblem && (
                  <span className="text-caption font-semibold text-overdue">
                    {t.quote.setupNeeded}
                  </span>
                )}
                {isChanged && (
                  <span className="text-caption font-semibold text-violet bg-violet-tint rounded-md px-1.5 py-0.5">
                    {t.quote.setupJustThis}
                  </span>
                )}
                {kept && (
                  <span className="flex items-center gap-1 text-caption text-success">
                    <Check size={11} /> {t.quote.setupKept}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={
                    decided.includes(row)
                      ? "font-body font-semibold text-small text-ink text-right"
                      : "font-body font-semibold text-small text-violet text-right"
                  }
                >
                  {decided.includes(row)
                    ? describeRow(row, setup, words, symbol)
                    : t.quote.setupChoose}
                </span>
                {isOpen ? (
                  <ChevronDown size={14} className="text-text-muted shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-text-muted shrink-0" />
                )}
              </span>
            </button>

            {/* What the usual was, and both ways out of a per-quote change.
                Outside the disclosure on purpose: a change you cannot see is
                the thing this whole block exists to prevent. */}
            {isChanged && !kept && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-5 pb-3 -mt-1">
                {/* Not on sections. A rate or a payment split is one value and
                    reads in three words; the usual sections spell out a list of
                    names that the row above is already showing. */}
                <span className="text-caption text-text-muted">
                  {row === "sections"
                    ? ""
                    : t.quote.setupUsually.replace("{value}", describeRow(row, usual, words, symbol))}
                </span>
                <span className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => putBack(row)}
                    className="flex items-center gap-1 text-caption text-slate hover:text-ink bg-none border-none cursor-pointer p-0 tap"
                  >
                    <RotateCcw size={11} /> {t.quote.setupPutBack}
                  </button>
                  <button
                    type="button"
                    onClick={() => onKeep(row)}
                    className="text-caption font-semibold text-violet bg-none border-none cursor-pointer p-0 tap"
                  >
                    {t.quote.setupMakeUsual}
                  </button>
                </span>
              </div>
            )}

            {isOpen && (
              <div className="px-5 pb-6">
                {/* What this row is for, in one line, under the heading it
                    belongs to. This replaced a grey box repeating "Asked once.
                    Saved to Memory" on every row: the same sentence four times
                    is furniture, and it explained the mechanism rather than the
                    question. Somebody opening "What the client gets" wants to
                    know what that means, not where it will be stored. */}
                {hasProblem && problemMessage ? (
                  <p className="font-body font-semibold text-caption text-overdue mt-0 mb-4 text-pretty">
                    {problemMessage}
                  </p>
                ) : (
                  <p className="text-caption text-slate mt-0 mb-4 text-pretty">
                    {rowHint(row, t)}
                  </p>
                )}
                {row === "rate" && (
                  <RateBody
                    draft={draft}
                    setDraft={setDraft}
                    rateHelpOpen={rateHelpOpen}
                    setRateHelpOpen={setRateHelpOpen}
                    pricedFor={pricedFor}
                    // Only when the level was read rather than stated, so the
                    // note explains where a value nobody typed came from.
                    readLevel={saved.expertiseLevel ? null : saved.inferredExpertise ?? null}
                    savedCountry={savedCountry}
                  />
                )}
                {row === "payment" && <PaymentBody draft={draft} setDraft={setDraft} />}
                {row === "sections" && (
                  <SectionsBody
                    draft={draft}
                    setDraft={setDraft}
                    sectionNotes={sectionNotes}
                    setSectionNotes={setSectionNotes}
                    availabilityNote={availabilityNote}
                    setAvailabilityNote={setAvailabilityNote}
                  />
                )}
                {row === "presentation" && (
                  <PresentationBody
                    draft={draft}
                    setDraft={setDraft}
                    hasBrand={hasBrand}
                    brandUpload={brandUpload}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** What you charge, and the market questions when you have not said. */
export function RateBody({
  draft,
  setDraft,
  rateHelpOpen,
  setRateHelpOpen,
  pricedFor,
  readLevel,
  savedCountry,
}: {
  draft: QuoteDraftPayload;
  setDraft: Dispatch<SetStateAction<QuoteDraftPayload>>;
  rateHelpOpen: boolean;
  setRateHelpOpen: (open: boolean) => void;
  pricedFor?: ReactNode;
  /** A level inferred from Memory rather than stated, if there is one. */
  readLevel?: string | null;
  /** The country already on the account, so it is not asked again. */
  savedCountry?: string | null;
}) {
  const t = useT();
  const unit = (draft.rateUnit ?? "HOUR") as RateUnit;
  const [country, setCountry] = useState(savedCountry ?? "");
  const [researching, setResearching] = useState(false);
  const [researched, setResearched] = useState<ResearchedRate | null>(null);
  const [rateError, setRateError] = useState("");

  async function research() {
    setRateError("");
    setResearching(true);
    try {
      const result = await researchRateAction({
        expertise: draft.expertiseLevel ?? "",
        country,
        currency: draft.currency ?? "USD",
        rateUnit: unit,
      });
      if (result.ok) {
        setResearched(result.data);
        // Filled in rather than offered and ignored. Somebody who pressed this
        // said they do not know what to charge, and handing them three numbers
        // to choose between is still asking them to decide. The middle is a
        // defensible answer, the ends are one press away, and the field is
        // still a field.
        if (result.data.suggested > 0) {
          setDraft((d) => ({ ...d, hourlyRate: result.data.suggested }));
        }
      } else setRateError(result.error);
    } catch {
      setRateError(t.common.noConnection);
    } finally {
      setResearching(false);
    }
  }

  return (
    <>
      {/* Plenty of freelancers price in days, and converting to an hourly
          figure to fit the form means inventing a day length. Fixed is a third
          thing again: one price, with no rate shown to the client at all. */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {(
          [
            ["HOUR", t.quote.perHour],
            ["DAY", t.quote.perDay],
            ["FIXED", t.quote.rateFixed],
          ] as const
        ).map(([value, label]) => (
          <Chip
            key={value}
            active={unit === value}
            onClick={() => setDraft((d) => ({ ...d, rateUnit: value }))}
          >
            {label}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={draft.currency}
          onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))}
          className="bg-paper rounded-lg border-none px-2 py-2.5 text-sm text-ink outline-none cursor-pointer"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
        <span className="text-slate text-sm">{currencySymbol(draft.currency)}</span>
        <input
          type="number"
          min={0}
          step={5}
          value={draft.hourlyRate || ""}
          onChange={(e) => setDraft((d) => ({ ...d, hourlyRate: Number(e.target.value) }))}
          placeholder={unit === "FIXED" ? "2400" : unit === "DAY" ? "520" : "65"}
          className="w-full bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
        />
        <span className="text-slate text-sm">{rateSuffix(unit, t.publicQuote)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
        <span className="text-meta text-text-muted">
          {unit === "FIXED"
            ? t.quote.rateFixedHint
            : draft.hourlyRate > 0
            ? t.quote.usedAsTyped
            : t.quote.orResearched}
        </span>
        <button
          type="button"
          onClick={() => {
            setRateHelpOpen(!rateHelpOpen);
            if (!rateHelpOpen) setDraft((d) => ({ ...d, hourlyRate: 0 }));
          }}
          className="text-meta font-semibold text-violet bg-none border-none cursor-pointer p-0 tap"
        >
          {rateHelpOpen ? t.quote.iKnowMyRate : t.quote.notSureWhatToCharge}
        </button>
      </div>

      {/* Seniority, only here, and only when there is no rate.
          It used to be a card of its own on every quote. Given a rate it
          changes nothing: £65/hour already says everything the level would.
          It only moves a number when the rate is being researched, so this is
          the one place it can affect anything. */}
      {rateHelpOpen && (
        <div className="mt-4 pt-4 border-t border-line">
          <SubLabel>{t.quote.expertise}</SubLabel>
          <div className="flex flex-wrap gap-1.5">
            {(["Junior", "Mid-level", "Senior", "Expert"] as const).map((level) => (
              <Chip
                key={level}
                active={draft.expertiseLevel === level}
                onClick={() => {
                  setDraft((d) => ({ ...d, expertiseLevel: level }));
                  // The old answer is about the old level, so it goes.
                  setResearched(null);
                }}
              >
                {level}
              </Chip>
            ))}
          </div>
          <p className="text-caption text-text-muted mt-1.5 mb-0">
            {readLevel
              ? t.quote.expertiseRead.replace("{level}", readLevel)
              : t.quote.expertiseHint}
          </p>

          {/* Where, then the button that turns the two answers into numbers.
              This is the whole point of the branch: somebody who says they do
              not know what to charge should leave it knowing, rather than
              having filled in two fields that quietly affect a price later. */}
          <div className="mt-4">
            <SubLabel>{t.onboarding.whereBased}</SubLabel>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setResearched(null);
                  const next = currencyForCountry(e.target.value);
                  if (e.target.value) setDraft((d) => ({ ...d, currency: next }));
                }}
                className="flex-1 min-w-[180px] bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none cursor-pointer"
              >
                <option value="">{t.onboarding.pickCountry}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                icon={Search}
                disabled={!country || !draft.expertiseLevel || researching}
                onClick={research}
              >
                {researching ? t.common.working : t.quote.findMyRate}
              </Button>
            </div>
          </div>

          {rateError && <p className="text-caption text-overdue mt-2 mb-0">{rateError}</p>}

          {researched && (
            <div className="mt-4">
              {researched.options.length > 0 ? (
                <>
                  <SubLabel>{t.quote.pickARate}</SubLabel>
                  <p className="text-caption text-text-muted mt-0 mb-2">{t.quote.rateFilledIn}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {researched.options.map((amount, index) => (
                      <Chip
                        key={amount}
                        active={draft.hourlyRate === amount}
                        onClick={() => setDraft((d) => ({ ...d, hourlyRate: amount }))}
                      >
                        {`${currencySymbol(draft.currency)}${amount.toLocaleString()}${rateSuffix(
                          unit,
                          t.publicQuote
                        )}`}
                        {/* Only the ends are labelled. Naming the middle one
                            "typical" would recommend it, and the point of a
                            range is that the choice is theirs. */}
                        {index === 0 && researched.options.length > 1
                          ? ` · ${t.quote.rateLower}`
                          : index === researched.options.length - 1 && researched.options.length > 1
                          ? ` · ${t.quote.rateUpper}`
                          : ""}
                      </Chip>
                    ))}
                  </div>
                </>
              ) : null}

              {/* The paragraph, always. Numbers with no provenance are numbers
                  nobody believes, and this is somebody deciding what to charge
                  for their work. */}
              <p className="text-caption text-text-muted mt-2.5 mb-0 text-pretty">
                {researched.note}
              </p>
            </div>
          )}

          {pricedFor}
        </div>
      )}
    </>
  );
}

/** When the money arrives, and how the work is chunked if it is billed that way. */
export function PaymentBody({
  draft,
  setDraft,
}: {
  draft: QuoteDraftPayload;
  setDraft: Dispatch<SetStateAction<QuoteDraftPayload>>;
}) {
  const t = useT();
  const plan = draft.paymentPlan ?? "SPLIT";
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["UPFRONT", t.quote.paymentUpfront],
            ["SPLIT", t.quote.paymentSplit],
            ["MILESTONE", t.quote.paymentMilestone],
          ] as const
        ).map(([value, label]) => (
          <Chip
            key={value}
            active={plan === value}
            onClick={() => setDraft((d) => ({ ...d, paymentPlan: value }))}
          >
            {label}
          </Chip>
        ))}
      </div>

      {plan === "SPLIT" && (
        <div className="mt-3">
          <SubLabel>{t.quote.paymentHowMuchUpfront}</SubLabel>
          <div className="flex flex-wrap gap-1.5">
            {[25, 40, 50].map((pct) => (
              <Chip
                key={pct}
                active={(draft.upfrontPercent ?? 50) === pct}
                onClick={() => setDraft((d) => ({ ...d, upfrontPercent: pct }))}
              >
                {`${pct}%`}
              </Chip>
            ))}
          </div>
          <p className="text-caption text-text-muted mt-1.5 mb-0">{t.quote.paymentRest}</p>
        </div>
      )}

      {plan === "MILESTONE" && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-caption text-text-muted m-0">{t.quote.paymentMilestoneHint}</p>
          <div>
            <SubLabel>{t.quote.milestonesHowMany}</SubLabel>
            {/* "Work it out" first and default: the natural number of chunks is
                a property of the work, and picking one before seeing the
                deliverables is guessing. */}
            <div className="flex flex-wrap gap-1.5">
              <Chip
                active={!draft.milestoneCount}
                onClick={() => setDraft((d) => ({ ...d, milestoneCount: undefined }))}
              >
                {t.quote.milestonesDecideForMe}
              </Chip>
              {[2, 3, 4, 5].map((n) => (
                <Chip
                  key={n}
                  active={draft.milestoneCount === n}
                  onClick={() => setDraft((d) => ({ ...d, milestoneCount: n }))}
                >
                  {String(n)}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <SubLabel>{t.quote.milestonesWhatGoesWhere}</SubLabel>
            <textarea
              value={draft.milestoneNotes ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, milestoneNotes: e.target.value }))}
              rows={2}
              placeholder={t.quote.milestonesNotesPlaceholder}
              className="w-full font-body text-small text-ink leading-relaxed bg-paper border border-line rounded-lg px-3 py-2.5 outline-none focus:border-violet"
            />
            <p className="text-caption text-text-muted mt-1 mb-0">{t.quote.milestonesNotesHint}</p>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Which sections the quote includes.
 *
 * Chips rather than a list of toggle rows, and every option visible whether it
 * is on or not: the choice here is a set, so seeing what is off is half the
 * information. The questions appear under the sections that rest on something
 * only the freelancer can say, and only when that section is actually on.
 */
export function SectionsBody({
  draft,
  setDraft,
  sectionNotes,
  setSectionNotes,
  availabilityNote,
  setAvailabilityNote,
}: {
  draft: QuoteDraftPayload;
  setDraft: Dispatch<SetStateAction<QuoteDraftPayload>>;
  sectionNotes: SectionNotes;
  setSectionNotes: Dispatch<SetStateAction<SectionNotes>>;
  availabilityNote: string;
  setAvailabilityNote: Dispatch<SetStateAction<string>>;
}) {
  const t = useT();
  const questions = SECTION_QUESTIONS.filter(
    (q) => draft[q.inclusion as keyof QuoteDraftPayload]
  );
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {ALL_SECTIONS.map((key) => (
          <Chip
            key={key}
            active={Boolean(draft[key as keyof QuoteDraftPayload])}
            onClick={() => setDraft((d) => ({ ...d, [key]: !d[key as keyof QuoteDraftPayload] }))}
          >
            {sectionName(key, t)}
          </Chip>
        ))}
      </div>
      <p className="text-caption text-text-muted mt-2 mb-0">{t.quote.setupSectionsNote}</p>

      {questions.length > 0 && (
        <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-line">
          {questions.map((q) => (
            <div key={q.key}>
              <SubLabel>{t.quote[q.promptKey]}</SubLabel>
              <textarea
                value={sectionNotes[q.key] ?? ""}
                onChange={(e) =>
                  setSectionNotes((notes) => ({ ...notes, [q.key]: e.target.value }))
                }
                rows={2}
                placeholder={t.quote[q.placeholderKey]}
                className="w-full font-body text-small text-ink leading-relaxed bg-paper border border-line rounded-lg px-3 py-2.5 outline-none focus:border-violet"
              />
            </div>
          ))}
        </div>
      )}

      {draft.includeAvailability && (
        <div className="mt-3">
          <SubLabel>{t.quote.availabilityPrompt}</SubLabel>
          <textarea
            value={availabilityNote}
            onChange={(e) => setAvailabilityNote(e.target.value)}
            rows={2}
            placeholder={t.quote.availabilityPlaceholder}
            className="w-full font-body text-small text-ink leading-relaxed bg-paper border border-line rounded-lg px-3 py-2.5 outline-none focus:border-violet"
          />
          <p className="text-caption text-text-muted mt-1 mb-0">{t.quote.availabilitySkipped}</p>
        </div>
      )}
    </>
  );
}

/** What the client receives and how it looks. */
export function PresentationBody({
  draft,
  setDraft,
  hasBrand,
  brandUpload,
}: {
  draft: QuoteDraftPayload;
  setDraft: Dispatch<SetStateAction<QuoteDraftPayload>>;
  hasBrand?: boolean;
  brandUpload?: ReactNode;
}) {
  const t = useT();
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["HTML", t.quote.formatHtml],
            ["PDF", t.quote.formatPdf],
            ["Figma", t.quote.formatFigma],
          ] as const
        ).map(([value, label]) => (
          <Chip
            key={value}
            active={draft.format === value}
            // Figma is not built. A chip that does nothing is worse than one
            // that says why, so it stays visible and says "coming soon".
            onClick={
              value === "Figma" ? undefined : () => setDraft((d) => ({ ...d, format: value }))
            }
          >
            {value === "Figma" ? `${label} · ${t.memory.comingSoon}` : label}
          </Chip>
        ))}
      </div>

      {(draft.format === "HTML" || draft.format === "PDF") && (
        <>
          <div className="mt-4">
            <SubLabel>{t.quote.branding}</SubLabel>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["freely", t.quote.brandFreely],
                  ["own", t.quote.brandOwn],
                  ["mono-light", t.quote.brandMonoLight],
                  ["mono-dark", t.quote.brandMonoDark],
                ] as const
              ).map(([value, label]) => (
                <Chip
                  key={value}
                  active={draft.branding === value}
                  onClick={() => setDraft((d) => ({ ...d, branding: value }))}
                >
                  {label}
                </Chip>
              ))}
            </div>
            {/* Only once somebody has asked for their own brand and there is
                none saved. It used to sit under the chips permanently, so every
                quote carried an upload box for a thing most of them were not
                using. "Your brand" is also pressable now even with nothing
                saved: a chip that ignores you teaches you nothing, and pressing
                it is exactly how somebody says they want this. */}
            {draft.branding === "own" && !hasBrand && <div className="mt-3">{brandUpload}</div>}
          </div>

          <div className="mt-4">
            <SubLabel>{t.quote.style}</SubLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  ["classic", t.quote.templateClassic, t.quote.templateClassicHint],
                  ["editorial", t.quote.templateEditorial, t.quote.templateEditorialHint],
                  ["minimal", t.quote.templateMinimal, t.quote.templateMinimalHint],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, template: value }))}
                  className={`text-left bg-white rounded-lg p-2.5 cursor-pointer transition-colors ${
                    draft.template === value
                      ? "border-[1.5px] border-violet"
                      : "border border-line hover:border-slate"
                  }`}
                >
                  <TemplatePreview id={value} />
                  <div className="font-body font-semibold text-small text-ink mt-2">{label}</div>
                  <div className="text-caption text-slate mt-0.5">{hint}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function rowLabel(row: SetupRowKey, t: Dictionary): string {
  switch (row) {
    case "rate":
      return t.quote.setupRate;
    case "payment":
      return t.quote.setupPayment;
    case "sections":
      return t.quote.setupSections;
    case "presentation":
      return t.quote.setupPresentation;
  }
}

/**
 * What a row is asking, said once, under its heading.
 *
 * A switch rather than a lookup, so a row added without a line fails to
 * compile instead of opening onto controls with no explanation.
 */
function rowHint(row: SetupRowKey, t: Dictionary): string {
  switch (row) {
    case "rate":
      return t.quote.setupRateHint;
    case "payment":
      return t.quote.setupPaymentHint;
    case "sections":
      return t.quote.setupSectionsHint;
    case "presentation":
      return t.quote.setupPresentationHint;
  }
}

function sectionName(key: SectionKey, t: Dictionary): string {
  switch (key) {
    case "includeStrategy":
      return t.quote.sectionStrategy;
    case "includeTimeline":
      return t.quote.sectionTimeline;
    case "includeSOW":
      return t.quote.sectionSow;
    case "includeTerms":
      return t.quote.sectionTerms;
    case "includeRevisions":
      return t.quote.sectionRevisions;
    case "includeAvailability":
      return t.quote.sectionAvailability;
    case "includeAI":
      return t.quote.sectionAi;
  }
}

/** The dictionary, as the plain strings lib/quote-defaults describes rows with. */
export function setupWords(t: Dictionary): SetupWords {
  return {
    perHour: t.quote.perHour.toLowerCase(),
    perDay: t.quote.perDay.toLowerCase(),
    fixed: t.quote.rateFixed.toLowerCase(),
    upfrontAll: t.quote.paymentUpfront,
    splitTemplate: t.quote.splitSummary,
    byMilestone: t.quote.paymentMilestone,
    and: t.common.and,
    nothingYet: t.quote.setupNotSet,
    sectionsNone: t.quote.setupSectionsNone,
    sectionNames: {
      includeStrategy: t.quote.sectionStrategy,
      includeTimeline: t.quote.sectionTimeline,
      includeSOW: t.quote.sectionSow,
      includeTerms: t.quote.sectionTerms,
      includeRevisions: t.quote.sectionRevisions,
      includeAvailability: t.quote.sectionAvailability,
      includeAI: t.quote.sectionAi,
    },
    formats: {
      HTML: t.quote.formatHtml,
      PDF: t.quote.formatPdf,
      Figma: t.quote.formatFigma,
    },
    templates: {
      classic: t.quote.templateClassic,
      editorial: t.quote.templateEditorial,
      minimal: t.quote.templateMinimal,
    },
    brandings: {
      freely: t.quote.brandFreely,
      own: t.quote.brandOwn,
      "mono-light": t.quote.brandMonoLight,
      "mono-dark": t.quote.brandMonoDark,
    },
  };
}

/** The section flags as a patch, for putting a row back to the usual. */
function sectionFlags(sections: SectionKey[]): Record<SectionKey, boolean> {
  const on = new Set(sections);
  return ALL_SECTIONS.reduce(
    (flags, key) => ({ ...flags, [key]: on.has(key) }),
    {} as Record<SectionKey, boolean>
  );
}

/**
 * The draft as a setup.
 *
 * The wizard holds these across a draft object and two pieces of sibling
 * state, and lib/quote-defaults reasons about one shape. The draft is
 * authoritative for everything it holds, including a value that arrived there
 * as a prefill from the account.
 */
export function setupFromDraft(
  draft: QuoteDraftPayload,
  sectionNotes: SectionNotes,
  availabilityNote: string
): QuoteSetup {
  return {
    rate: draft.hourlyRate,
    rateUnit: (draft.rateUnit ?? "HOUR") as RateUnit,
    currency: draft.currency || "USD",
    paymentPlan: draft.paymentPlan ?? "SPLIT",
    upfrontPercent: draft.upfrontPercent ?? 50,
    sections: ALL_SECTIONS.filter((key) => Boolean(draft[key as keyof QuoteDraftPayload])),
    termsNote: sectionNotes.terms ?? "",
    revisionsNote: sectionNotes.revisions ?? "",
    aiUsageNote: sectionNotes.aiUsage ?? "",
    availabilityNote,
    format: draft.format,
    template: draft.template ?? "classic",
    branding: draft.branding ?? "freely",
    expertise: draft.expertiseLevel,
  };
}
