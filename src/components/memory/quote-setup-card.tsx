"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  RateBody,
  PaymentBody,
  SectionsBody,
  PresentationBody,
  setupFromDraft,
} from "@/components/quote/setup-rows";
import { everything, resolveSetup, type AccountDefaults } from "@/lib/quote-defaults";
import { saveQuoteSetupAction } from "@/actions/quote-defaults";
import type { SectionNotes } from "@/lib/quote-prompts";
import type { QuoteDraftPayload } from "@/actions/briefs";
import { useT } from "@/lib/i18n/context";

/**
 * The quote setup, on the Memory page.
 *
 * The wizard stopped asking these on every quote, so this is where they are
 * changed when they change. Same controls, deliberately: it renders the wizard's
 * own row bodies rather than a second copy of them, so the two cannot drift
 * into disagreeing about what a payment split or a section set looks like.
 *
 * The adapter is a draft-shaped object, because that is what those bodies read.
 * The saved values fill it, and every edit writes the whole setup back.
 *
 * Saves as you go, like the notes above it. A Save button on a page of
 * preferences is a step that only exists to be forgotten.
 */
export function QuoteSetupCard({
  saved,
  hasBrand,
  country,
  disciplines = [],
  children,
}: {
  saved: AccountDefaults;
  hasBrand?: boolean;
  /** Everything this account does, main one first. The rate row shows one
   * rate per kind of work, the same as the wizard does. */
  disciplines?: { key: string; label: string }[];
  /** ISO 3166-1 alpha-2, so the rate helper does not ask again. */
  country?: string | null;
  /** Currency and quote language, which belong to this decision rather than to
   * branding, where they used to live. */
  children?: React.ReactNode;
}) {
  const t = useT();
  const usual = resolveSetup(saved);
  const [savedAt, setSavedAt] = useState(false);
  const firstRender = useRef(true);

  const [draft, setDraft] = useState<QuoteDraftPayload>(() => ({
    sourceText: "",
    instructions: "",
    memoryProjectTitles: [],
    format: usual.format,
    includeStrategy: usual.sections.includes("includeStrategy"),
    includeTimeline: usual.sections.includes("includeTimeline"),
    includeSOW: usual.sections.includes("includeSOW"),
    includeTerms: usual.sections.includes("includeTerms"),
    includeRevisions: usual.sections.includes("includeRevisions"),
    includeAvailability: usual.sections.includes("includeAvailability"),
    includeAI: usual.sections.includes("includeAI"),
    hourlyRate: usual.rate,
    rateUnit: usual.rateUnit,
    currency: usual.currency,
    paymentPlan: usual.paymentPlan,
    upfrontPercent: usual.upfrontPercent,
    expertiseLevel: usual.expertise,
    // Their main one, which is the rate the account already holds.
    discipline: saved.industry ?? undefined,
    template: usual.template,
    branding: usual.branding,
  }));
  const [sectionNotes, setSectionNotes] = useState<SectionNotes>(() => ({
    terms: saved.defaultTermsNote ?? "",
    revisions: saved.defaultRevisionsNote ?? "",
    aiUsage: saved.defaultAiUsageNote ?? "",
  }));
  const [availabilityNote, setAvailabilityNote] = useState(saved.defaultAvailabilityNote ?? "");
  /** Whether a level has been stated, as opposed to read off Memory. */
  const [stated, setStated] = useState(Boolean(saved.expertiseLevel));
  // Which section is open, or none. One at a time: opening a second closes the
  // first, because two open sections is most of the way back to the wall of
  // controls this replaced.
  const [open, setOpen] = useState<string | null>(null);
  // Held here rather than inside RateBody, so opening the Rate row and pressing
  // "Not sure what to charge" survive each other.
  const [rateHelpOpen, setRateHelpOpen] = useState(false);

  // Debounced, because the notes are typed into. A save per keystroke would be
  // a write per character.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void saveQuoteSetupAction({
        ...everything(setupFromDraft(draft, sectionNotes, availabilityNote)),
        // Only written once somebody picks one, so an untouched account keeps
        // reading the level off its Memory rather than freezing today's guess
        // into a stated fact.
        ...(stated ? { expertiseLevel: draft.expertiseLevel } : {}),
        // Editing the rate while a second kind of work is selected edits that
        // work's rate, and leaves the main one alone.
        ...(draft.discipline && draft.discipline !== saved.industry
          ? {
              defaultRate: undefined,
              defaultRateUnit: undefined,
              rateForDiscipline: {
                discipline: draft.discipline,
                rate: draft.hourlyRate,
                unit: draft.rateUnit ?? "HOUR",
              },
            }
          : {}),
      }).then((result) => {
        if (result.ok) {
          setSavedAt(true);
          setTimeout(() => setSavedAt(false), 1800);
        }
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, sectionNotes, availabilityNote, stated, saved.industry]);

  const readLevel = stated ? null : saved.inferredExpertise ?? null;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <Label>{t.memory.quoteSetup}</Label>
        {savedAt && (
          <span className="flex items-center gap-1 text-caption text-success">
            <Check size={11} /> {t.memory.saved}
          </span>
        )}
      </div>
      <p className="text-meta text-slate mt-1 mb-4 leading-relaxed">{t.memory.quoteSetupHint}</p>

      {/* One at a time, all closed. Five sections open at once is the long
          scroll the tabs were meant to end, one level further in. Each row
          says what it holds, which is enough to find the one you came for. */}
      <div className="flex flex-col">
        <Section id="rate" open={open} onToggle={setOpen} label={t.quote.setupRate}>
          {/* The same helper the wizard has, rather than a dead prop.
              It used to be switched off here on the reasoning that researching
              a rate belongs to a quote. That left "Your expertise level" as a
              row of its own, which is a question with no visible purpose: on
              its own it changes nothing, and it only means anything inside the
              branch where somebody says they do not know what to charge. So it
              lives there now, with a country and a button, and this row is the
              one place a rate gets decided either way. */}
          <RateBody
            draft={draft}
            setDraft={setDraft}
            rateHelpOpen={rateHelpOpen}
            setRateHelpOpen={(next) => {
              setRateHelpOpen(next);
              // Choosing a level in here is stating one, the same as it is in
              // the wizard, so the account stops reading it off the persona.
              if (next) setStated(true);
            }}
            readLevel={readLevel}
            savedCountry={country ?? null}
            disciplines={disciplines}
            account={saved}
          />
        </Section>

        <Section id="payment" open={open} onToggle={setOpen} label={t.quote.setupPayment}>
          <PaymentBody draft={draft} setDraft={setDraft} />
        </Section>

        <Section id="sections" open={open} onToggle={setOpen} label={t.quote.setupSections}>
          <SectionsBody
            draft={draft}
            setDraft={setDraft}
            sectionNotes={sectionNotes}
            setSectionNotes={setSectionNotes}
            availabilityNote={availabilityNote}
            setAvailabilityNote={setAvailabilityNote}
          />
        </Section>

        <Section
          id="presentation"
          open={open}
          onToggle={setOpen}
          label={t.quote.setupPresentation}
        >
          <PresentationBody draft={draft} setDraft={setDraft} hasBrand={hasBrand} />
        </Section>

        {children && (
          <Section id="language" open={open} onToggle={setOpen} label={t.quote.quoteLanguage}>
            {children}
          </Section>
        )}
      </div>
    </Card>
  );
}

/** One collapsible section. The label is the whole closed state, which is the
 * point: six short rows are scannable, six open panels are not. */
function Section({
  id,
  label,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  open: string | null;
  onToggle: (next: string | null) => void;
  children: ReactNode;
}) {
  const isOpen = open === id;
  return (
    <div className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={() => onToggle(isOpen ? null : id)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-3 text-left bg-none border-none cursor-pointer px-0 py-4 hover:text-violet transition-colors"
      >
        {/* Weighted as a heading once it is open, the same way the wizard's
            rows are, so the two places these controls appear read alike. */}
        <span
          className={
            isOpen
              ? "font-body font-bold text-body text-ink"
              : "font-body font-semibold text-small text-slate"
          }
        >
          {label}
        </span>
        {isOpen ? (
          <ChevronDown size={14} className="text-text-muted shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-text-muted shrink-0" />
        )}
      </button>
      {isOpen && <div className="pb-6">{children}</div>}
    </div>
  );
}
