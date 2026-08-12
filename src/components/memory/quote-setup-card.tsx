"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label, SubLabel } from "@/components/ui/label";
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

      <div className="flex flex-col gap-5">
        <div>
          <SubLabel>{t.quote.setupRate}</SubLabel>
          {/* No rate helper here: researching a rate is a thing a quote does
              with a market and a brief in front of it, not a preference. */}
          <RateBody
            draft={draft}
            setDraft={setDraft}
            rateHelpOpen={false}
            setRateHelpOpen={() => {}}
          />
        </div>

        <div className="pt-5 border-t border-line">
          <SubLabel>{t.quote.expertise}</SubLabel>
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
        </div>

        <div className="pt-5 border-t border-line">
          <SubLabel>{t.quote.setupPayment}</SubLabel>
          <PaymentBody draft={draft} setDraft={setDraft} />
        </div>

        <div className="pt-5 border-t border-line">
          <SubLabel>{t.quote.setupSections}</SubLabel>
          <SectionsBody
            draft={draft}
            setDraft={setDraft}
            sectionNotes={sectionNotes}
            setSectionNotes={setSectionNotes}
            availabilityNote={availabilityNote}
            setAvailabilityNote={setAvailabilityNote}
          />
        </div>

        <div className="pt-5 border-t border-line">
          <SubLabel>{t.quote.setupPresentation}</SubLabel>
          <PresentationBody draft={draft} setDraft={setDraft} hasBrand={hasBrand} />
        </div>

        {children && <div className="pt-5 border-t border-line">{children}</div>}
      </div>
    </Card>
  );
}
