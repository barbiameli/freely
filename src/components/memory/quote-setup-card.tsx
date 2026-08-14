"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import {
  RateBody,
  PaymentBody,
  SectionsBody,
  PresentationBody,
  setupFromDraft,
} from "@/components/quote/setup-rows";
import {
  everything,
  resolveSetup,
  type AccountDefaults,
  type ExpertiseLevel,
} from "@/lib/quote-defaults";
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
  children,
}: {
  saved: AccountDefaults;
  hasBrand?: boolean;
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
      }).then((result) => {
        if (result.ok) {
          setSavedAt(true);
          setTimeout(() => setSavedAt(false), 1800);
        }
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, sectionNotes, availabilityNote, stated]);

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
          {/* No rate helper here: researching a rate is something a quote does
              with a market and a brief in front of it, not a preference. */}
          <RateBody
            draft={draft}
            setDraft={setDraft}
            rateHelpOpen={false}
            setRateHelpOpen={() => {}}
          />
        </Section>

        <Section id="level" open={open} onToggle={setOpen} label={t.quote.expertise}>
          <div className="flex flex-wrap gap-1.5">
            {(["Junior", "Mid-level", "Senior", "Expert"] as const).map((level) => (
              <Chip
                key={level}
                active={draft.expertiseLevel === level}
                onClick={() => {
                  setStated(true);
                  setDraft((d) => ({ ...d, expertiseLevel: level as ExpertiseLevel }));
                }}
              >
                {level}
              </Chip>
            ))}
          </div>
          <p className="text-caption text-text-muted mt-1.5 mb-0">
            {readLevel ? t.quote.expertiseRead.replace("{level}", readLevel) : t.quote.expertiseHint}
          </p>
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
        className="w-full flex items-center justify-between gap-3 text-left bg-none border-none cursor-pointer px-0 py-3 hover:text-violet transition-colors"
      >
        <span className="font-body font-semibold text-small text-ink">{label}</span>
        {isOpen ? (
          <ChevronDown size={14} className="text-text-muted shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-text-muted shrink-0" />
        )}
      </button>
      {isOpen && <div className="pb-4">{children}</div>}
    </div>
  );
}
