"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Sparkles,
  CircleStop,
  ImagePlus,
  Trash2,
  Check,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label, SubLabel } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/ui/drop-zone";
import {
  generateBriefAction,
  addBriefExampleAction,
  type QuoteDraftPayload,
} from "@/actions/briefs";
import { parseRateUnit } from "@/lib/rate-unit";
import { useT, useLocale } from "@/lib/i18n/context";
import { MAX_DOCUMENT_UPLOAD_BYTES, documentTooLargeError } from "@/lib/upload-limits";
import {
  projectPresetKeys,
  sectionNoteLines,
  toggleExampleLine,
  availabilityFacts,
  type SectionNotes,
} from "@/lib/quote-prompts";
import { readPastedText } from "@/lib/paste-text";
import { extractFileText } from "@/lib/extract-file";
import { QuoteTabs, type QuoteTab } from "@/components/quote-tabs";
import { LandedPrompt, type LandedQuote } from "@/components/landed-prompt";
import { SignedBanner, type SignedQuote } from "@/components/signed-banner";
import { QuoteList } from "@/components/quote-list";
import {
  analyzeBrandGuideAction,
  analyzeBrandGuideImageAction,
  uploadBrandLogoAction,
} from "@/actions/memory";
import { SetupRows, setupFromDraft } from "@/components/quote/setup-rows";
import {
  learnQuoteDefaultsAction,
  keepQuoteDefaultAction,
} from "@/actions/quote-defaults";
import { resolveSetup, type AccountDefaults, type SetupRowKey } from "@/lib/quote-defaults";

import type { BriefSummary } from "@/components/brief-card";

/** A visual reference held in wizard state. These can only be saved once the
 * brief exists (a BriefExample needs a briefId), so they're attached
 * immediately after generation succeeds. */
interface ReferenceImage {
  name: string;
  dataUrl: string;
  caption: string;
}

// Generation involves a real Claude call (sometimes with web search on top),
// so it can genuinely take a while — but it should never just hang with no
// feedback. If nothing comes back within this window, give up and show a
// real error instead of spinning forever (matches the quote page's own
// maxDuration route config, plus a little slack).
const GENERATION_TIMEOUT_MS = 65_000;

// A real progress percentage isn't knowable — there's no way to ask an LLM
// call how far along it is. This eases toward (but deliberately never
// quite reaches) 100%, tuned against GENERATION_TIMEOUT_MS, so there's at
// least a sense of forward motion instead of a frozen spinner.
function fakeProgress(elapsedMs: number): number {
  const t = elapsedMs / GENERATION_TIMEOUT_MS;
  return Math.min(96, Math.round(100 * (1 - Math.exp(-3 * t))));
}

// Lighthearted, rotating stand-ins for a static "Generating..." label —
// written like the AI's own internal (very informal) monologue. This is
// the practical version of "surface the AI's thoughts": true token-level
// thought streaming would mean rebuilding this as a streaming endpoint
// instead of a Server Action, which is a much bigger change than a wall
// of silence during a 20-40 second wait justifies.
const GENERATION_STATUS_MESSAGES = [
  "Reading through everything you've handed over...",
  "Doing some suspiciously fast napkin math on hours...",
  "Cross-checking against your past quotes...",
  "Politely negotiating with your hourly rate...",
  "Making sure the timeline doesn't sound delusional...",
  "Borrowing a bit of your studio's voice (hope that's ok)...",
  "Arguing with itself about the price, briefly...",
  "Tightening up the scope...",
  "Proofreading like a very picky editor...",
  "Adding a dash of confidence, subtracting the filler...",
  "Nearly there, promise...",
];

/** Marks a field as required or optional, as plain text. A pill here reads as
 * a chip, and chips in this interface are things you click. */
function FieldBadge({ required }: { required?: boolean }) {
  const t = useT();
  return (
    <span className="text-caption text-text-muted">
      {required ? t.common.required : t.common.optional}
    </span>
  );
}

/** A Label with a required/optional badge alongside it. */
function FieldHeading({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap mb-1">
      <Label>{children}</Label>
      <FieldBadge required={required} />
    </div>
  );
}

export function QuoteWizard({
  recentBriefs,
  landedQuotes = [],
  signed = [],
  initialTab = "new",
  userCurrency,
  hasBrand,
  savedLocation,
  savedRate,
  savedRateUnit,
  industry,
  saved = {},
}: {
  recentBriefs: BriefSummary[];
  /** Quotes old enough to have an answer, for the "did you land these?" prompt. */
  landedQuotes?: LandedQuote[];
  /** Quotes a client has signed that the freelancer has not been told about. */
  signed?: SignedQuote[];
  /** Which tab to open on, so /quote?tab=all lands on the list. */
  initialTab?: QuoteTab;
  userCurrency?: string | null;
  hasBrand?: boolean;
  savedLocation?: string;
  /** The rate saved in Memory, prefilled so it is not retyped each time. */
  savedRate?: number;
  savedRateUnit?: string;
  /** The field chosen at onboarding, so the examples match the actual work. */
  industry?: string | null;
  /** The quote setup remembered on the account, prefilled into the draft and
   * used to tell a per-quote change from simply the answer. */
  saved?: AccountDefaults;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [tab, setTab] = useState<QuoteTab>(initialTab);
  // The draft starts as whatever the account remembers, so a second quote opens
  // already answered. resolveSetup fills every gap, so nothing here is null
  // and the wizard never has to reason about "not set".
  const [draft, setDraft] = useState<QuoteDraftPayload>(() => {
    const usual = resolveSetup(saved);
    return {
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
      hourlyRate: savedRate ?? usual.rate,
      rateUnit: savedRateUnit ? parseRateUnit(savedRateUnit) : usual.rateUnit,
      currency: userCurrency || usual.currency,
      paymentPlan: usual.paymentPlan,
      upfrontPercent: usual.upfrontPercent,
      // Not a question any more. Given a rate the level changes nothing, so it
      // is read off Memory and only editable where it can matter, inside the
      // rate helper. See lib/quote-defaults.
      expertiseLevel: usual.expertise,
      template: usual.template,
      // Someone who has set up their own branding almost always wants to send
      // a quote under it, so that's the default whenever it's available.
      branding: saved.defaultBranding ? usual.branding : hasBrand ? "own" : "freely",
      pricing: { yourLocation: savedLocation || "" },
      // Defaults to the interface language, since most quotes go out in the
      // language the freelancer works in, and is changed per quote when they do
      // not match.
      language: locale,
    };
  });
  const [availabilityNote, setAvailabilityNote] = useState(saved.defaultAvailabilityNote ?? "");
  // One optional question per section that rests on a decision only the
  // freelancer can make. See SECTION_QUESTIONS.
  const [sectionNotes, setSectionNotes] = useState<SectionNotes>(() => ({
    terms: saved.defaultTermsNote ?? "",
    revisions: saved.defaultRevisionsNote ?? "",
    aiUsage: saved.defaultAiUsageNote ?? "",
  }));
  // Which examples are currently in the text, so a chip can show as selected
  // and be clicked again to take it back out.
  const [pickedExamples, setPickedExamples] = useState<string[]>([]);
  const [sourceMode, setSourceMode] = useState<"paste" | "upload">("upload");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState(GENERATION_STATUS_MESSAGES[0]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  // Which interpretation presets are currently in the instructions, so they
  // read as selected and clicking again takes them out rather than pasting a
  // second copy.
  // The location questions exist only to research a rate, so they stay hidden
  // unless someone says they are unsure.
  const [showRateHelp, setShowRateHelp] = useState(false);
  // Rows kept as the usual during this quote, so the offer is not repeated.
  const [keptRows, setKeptRows] = useState<SetupRowKey[]>([]);
  // Branding can be added without leaving the wizard, so a half-filled brief
  // isn't lost to a trip to Memory.
  const [showBrandUpload, setShowBrandUpload] = useState(false);
  const [brandBusy, setBrandBusy] = useState<"guide" | "logo" | null>(null);
  const [brandError, setBrandError] = useState("");
  const [brandSaved, setBrandSaved] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  // A late-arriving response from a request the user already cancelled (or
  // that we already gave up on via the timeout) should be silently ignored,
  // not applied to the UI or navigated to.
  const cancelledRef = useRef(false);
  const timersRef = useRef<{
    messageInterval?: ReturnType<typeof setInterval>;
    progressInterval?: ReturnType<typeof setInterval>;
    timeout?: ReturnType<typeof setTimeout>;
  }>({});

  function clearGenerationTimers() {
    if (timersRef.current.messageInterval) clearInterval(timersRef.current.messageInterval);
    if (timersRef.current.progressInterval) clearInterval(timersRef.current.progressInterval);
    if (timersRef.current.timeout) clearTimeout(timersRef.current.timeout);
    timersRef.current = {};
  }

  useEffect(() => clearGenerationTimers, []);

  async function handleFile(file: File) {
    setError("");
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      setError(documentTooLargeError(file));
      return;
    }
    setUploading(true);
    const result = await extractFileText(file);
    setUploading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFileName(result.fileName);
    setDraft((d) => ({ ...d, sourceText: result.text }));
  }

  async function handleGenerate() {
    const missing = whatIsMissing();
    if (missing) {
      // The rate is the likely offender, and it is the one row that may be
      // closed, so open the helper along with the message.
      if (missing === t.quote.addRateOrLocationLong) setShowRateHelp(true);
      setError(missing);
      return;
    }
    setGenerating(true);
    setError("");
    setProgress(0);
    cancelledRef.current = false;

    let messageIndex = 0;
    setStatusMessage(GENERATION_STATUS_MESSAGES[0]);
    timersRef.current.messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % GENERATION_STATUS_MESSAGES.length;
      setStatusMessage(GENERATION_STATUS_MESSAGES[messageIndex]);
    }, 3500);

    const startedAt = Date.now();
    timersRef.current.progressInterval = setInterval(() => {
      setProgress(fakeProgress(Date.now() - startedAt));
    }, 250);

    const timeout = new Promise<never>((_, reject) => {
      timersRef.current.timeout = setTimeout(
        () => reject(new Error("TIMEOUT")),
        GENERATION_TIMEOUT_MS
      );
    });

    try {
      // Availability is stated by the freelancer, so it is attached here
      // rather than living in the draft, and an empty list means the section
      // is skipped rather than invented.
      const payload: QuoteDraftPayload = {
        ...draft,
        availability: { facts: availabilityFacts(availabilityNote) },
        sectionNotes: sectionNoteLines(sectionNotes),
      };
      // Not awaited: failing to remember a preference is no reason to hold up
      // someone's quote. This only fills rows that have never been decided, so
      // pricing one job as a fixed fee cannot make every later quote fixed. A
      // fixed price is a total for one project rather than a rate to reuse,
      // which lib/quote-defaults handles by only learning a rate above zero
      // alongside its unit.
      void learnQuoteDefaultsAction(setupFromDraft(draft, sectionNotes, availabilityNote));
      const result = await Promise.race([generateBriefAction(payload), timeout]);
      if (cancelledRef.current) return;
      clearGenerationTimers();
      setGenerating(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Visual references couldn't be saved before now: a BriefExample needs
      // a briefId. Failures here are deliberately not fatal, the quote itself
      // is already safely stored and the references can be re-added on the
      // brief page.
      for (const ref of references) {
        await addBriefExampleAction(
          result.data.briefId,
          ref.name,
          ref.dataUrl,
          ref.caption.trim() || "Visual reference"
        );
      }
      router.push(`/quote/${result.data.briefId}`);
    } catch (err) {
      clearGenerationTimers();
      if (cancelledRef.current) return;
      setGenerating(false);
      setError(
        err instanceof Error && err.message === "TIMEOUT"
          ? t.quote.generatingTooLong
          : t.quote.generateFailed
      );
    }
  }

  /** Keeps headings, paragraphs and bullets when pasting from a doc or an
   * email, which otherwise arrive as one unbroken block. */
  function handlePasteSource(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = readPastedText(e.clipboardData);
    if (!text) return;
    e.preventDefault();
    const target = e.currentTarget;
    const { selectionStart, selectionEnd, value } = target;
    const next = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
    setDraft((d) => ({ ...d, sourceText: next }));
    // Put the caret after what was just pasted.
    requestAnimationFrame(() => {
      const caret = selectionStart + text.length;
      target.setSelectionRange(caret, caret);
    });
  }

  async function handleBrandGuide(file: File) {
    setBrandError("");
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      setBrandError(documentTooLargeError(file));
      return;
    }
    setBrandBusy("guide");
    try {
      if (/^image\/(png|jpeg)$/.test(file.type)) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Couldn't read that image."));
          reader.readAsDataURL(file);
        });
        const result = await analyzeBrandGuideImageAction(dataUrl);
        if (!result.ok) throw new Error(result.error);
      } else {
        const extracted = await extractFileText(file);
        if (!extracted.ok) throw new Error(extracted.error);
        const result = await analyzeBrandGuideAction(extracted.text);
        if (!result.ok) throw new Error(result.error);
      }
      setBrandSaved(true);
      setDraft((d) => ({ ...d, branding: "own" }));
      router.refresh();
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : "Couldn't read that file.");
    }
    setBrandBusy(null);
  }

  async function handleBrandLogo(file: File) {
    setBrandError("");
    setBrandBusy("logo");
    try {
      // uploadBrandLogoAction reads the PNG header to check transparency and
      // resolution, so it wants the file itself.
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadBrandLogoAction(formData);
      if (!result.ok) throw new Error(result.error);
      setBrandSaved(true);
      setDraft((d) => ({ ...d, branding: "own" }));
      router.refresh();
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : "Couldn't upload that logo.");
    }
    setBrandBusy(null);
  }

  function handleReferenceImage(file: File) {
    setError("");
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      setError(documentTooLargeError(file));
      return;
    }
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setError("Visual references need to be a PNG or JPG.");
      return;
    }
    setImageUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setImageUploading(false);
      setReferences((prev) => [
        ...prev,
        { name: file.name, dataUrl: String(reader.result), caption: "" },
      ]);
    };
    reader.onerror = () => {
      setImageUploading(false);
      setError("Couldn't read that image.");
    };
    reader.readAsDataURL(file);
  }

  /**
   * What has to be true before anything can be generated.
   *
   * Validates and says what is missing, rather than greying out the button
   * and refusing to explain. This used to run on Continue between the two
   * steps; with one screen it runs here, which is the only moment left.
   */
  function whatIsMissing(): string {
    if (!draft.sourceText.trim()) return t.quote.addSource;
    // Either they price the work, or they say where it is being priced for,
    // since a rate cannot be researched without a market.
    if (
      (!draft.hourlyRate || draft.hourlyRate <= 0) &&
      !draft.pricing?.yourLocation?.trim() &&
      !draft.pricing?.clientLocation?.trim()
    ) {
      return t.quote.addRateOrLocationLong;
    }
    return "";
  }

  /** "Make this my usual", for the row that was changed. */
  async function handleKeepRow(row: SetupRowKey) {
    setKeptRows((rows) => (rows.includes(row) ? rows : [...rows, row]));
    const result = await keepQuoteDefaultAction(
      row,
      setupFromDraft(draft, sectionNotes, availabilityNote)
    );
    // Put the offer back if it did not save, rather than showing a tick for
    // something that is not stored.
    if (!result.ok) setKeptRows((rows) => rows.filter((r) => r !== row));
  }

  /**
   * The market questions, shown under the rate only when there is no rate.
   *
   * Six fields, cut to four. Where you are based comes from Memory, since it
   * is asked at onboarding and does not change; and "done this kind of work
   * before?" was asking about seniority twice, which is what the level covers.
   * What is left is all about this client rather than about you.
   */
  const pricedForFields = (
    <div className="mt-4">
      <SubLabel>{t.quote.pricedFor}</SubLabel>
      <p className="text-caption text-text-muted mt-0 mb-2.5">{t.quote.pricedForHint}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {(
          [
            // Only asked when Memory has nothing. Otherwise it is stated below
            // rather than being a field to fill in again.
            ...(savedLocation
              ? []
              : [{ key: "yourLocation" as const, label: t.quote.yourLocation }]),
            { key: "clientLocation" as const, label: t.quote.clientLocation },
            { key: "clientType" as const, label: t.quote.clientType },
            { key: "budgetHint" as const, label: t.quote.budgetHint },
            { key: "urgency" as const, label: t.quote.urgency },
          ]
        ).map((field) => (
          <label key={field.key} className="block">
            <SubLabel className="mb-1">{field.label}</SubLabel>
            <input
              value={draft.pricing?.[field.key] || ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  pricing: { ...d.pricing, [field.key]: e.target.value },
                }))
              }
              className="w-full font-body text-small text-ink bg-paper border border-line rounded-lg px-2.5 py-2 outline-none"
            />
          </label>
        ))}
      </div>
      <p className="text-caption text-text-muted mt-2 mb-0">
        {savedLocation ? t.quote.pricedFrom.replace("{place}", savedLocation) : t.quote.pricedForFooter}
      </p>
    </div>
  );

  /** Adding branding without leaving the wizard, so a pasted brief is not lost
   * to a trip to Memory. */
  const brandUpload = showBrandUpload ? (
    <div className="bg-paper border border-line rounded-lg p-3.5">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="font-body font-semibold text-small text-ink">
            {t.quote.addYourBranding}
          </div>
          <div className="text-caption text-slate mt-0.5">{t.quote.addYourBrandingHint}</div>
        </div>
        <button
          type="button"
          onClick={() => setShowBrandUpload(false)}
          className="shrink-0 text-caption text-text-muted bg-none border-none cursor-pointer p-0 tap"
        >
          {t.common.close}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-3">
        <DropZone
          onFile={handleBrandGuide}
          accept=".pdf,.docx,.txt,.md,image/png,image/jpeg"
          disabled={brandBusy !== null}
          className="flex-1 flex flex-col gap-1 cursor-pointer bg-white border border-dashed border-line rounded-lg px-3 py-2.5"
        >
          <span className="flex items-center gap-1.5 font-body font-bold text-small text-violet">
            <FileText size={12} />
            {brandBusy === "guide" ? t.quote.reading : t.memory.brandGuidelines}
          </span>
          <span className="text-caption text-text-muted">{t.quote.fileTypes}</span>
        </DropZone>

        <DropZone
          onFile={handleBrandLogo}
          accept="image/png"
          disabled={brandBusy !== null}
          className="flex-1 flex flex-col gap-1 cursor-pointer bg-white border border-dashed border-line rounded-lg px-3 py-2.5"
        >
          <span className="flex items-center gap-1.5 font-body font-bold text-small text-violet">
            <ImagePlus size={12} />
            {brandBusy === "logo" ? t.quote.uploading : t.quote.logo}
          </span>
          <span className="text-caption text-text-muted">{t.quote.transparentPng}</span>
        </DropZone>
      </div>

      {brandError && <div className="text-overdue text-caption mt-2">{brandError}</div>}
      {brandSaved && (
        <div className="flex items-center gap-1.5 text-success text-caption mt-2">
          <Check size={12} /> {t.quote.brandingSaved}
        </div>
      )}
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setShowBrandUpload(true)}
      className="text-caption font-semibold text-violet bg-none border-none cursor-pointer p-0 tap"
    >
      {t.quote.addYourBranding}
    </button>
  );

  function handleStopGenerating() {
    cancelledRef.current = true;
    clearGenerationTimers();
    setGenerating(false);
    setError("Generation stopped. Change anything above and try again whenever you're ready.");
  }

  return (
    <>
      {tab === "all" && (
        <>
          <Topbar />
          {/* Above the tabs, because this is news and a question, and both are
              worth reading before the list they are about. */}
          <SignedBanner signed={signed} />
          <LandedPrompt quotes={landedQuotes} />
          <QuoteTabs value={tab} onChange={setTab} count={recentBriefs.length} />
          <QuoteList briefs={recentBriefs} onStartNew={() => setTab("new")} />
        </>
      )}

      {tab === "new" && (
        <>
          <Topbar />
          <SignedBanner signed={signed} />
          <LandedPrompt quotes={landedQuotes} />
          <QuoteTabs value={tab} onChange={setTab} count={recentBriefs.length} />
          <div>
            <h1 className="font-display italic text-[30px] md:text-4xl text-coral m-0">
              {t.quote.titleStep1}
            </h1>
            <p className="text-slate text-lead mt-2">
              {t.quote.subtitleStep1}
            </p>
          </div>
          {/* One bordered container: the two choices sit side by side as a
              toggle at the top, and the input for whichever is selected
              expands underneath, inside the same box. */}
          <div className="bg-white border border-line rounded-card overflow-hidden">
            <div className="flex flex-col sm:flex-row">
              {(
                [
                  {
                    mode: "upload" as const,
                    icon: Upload,
                    title: t.quote.uploadBrief,
                    blurb: t.quote.uploadBriefHint,
                  },
                  {
                    mode: "paste" as const,
                    icon: FileText,
                    title: t.quote.pasteText,
                    blurb: t.quote.pasteTextHint,
                  },
                ]
              ).map(({ mode, icon: Icon, title, blurb }, i) => {
                const selected = sourceMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSourceMode(mode)}
                    aria-pressed={selected}
                    className={`flex-1 text-left flex items-start gap-3 px-5 py-4 border-none cursor-pointer transition-colors ${
                      selected ? "bg-violet-tint" : "bg-white hover:bg-paper"
                    } ${i === 0 ? "sm:border-r border-line" : ""}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        selected ? "bg-white" : "bg-paper"
                      }`}
                    >
                      <Icon size={16} className={selected ? "text-violet" : "text-text-muted"} />
                    </div>
                    <span className="min-w-0">
                      <span
                        className={`block font-body font-semibold text-body ${
                          selected ? "text-violet" : "text-ink"
                        }`}
                      >
                        {title}
                      </span>
                      <span className="block text-slate text-small mt-0.5">{blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Grid-rows animates from 0 to auto, which a max-height
                transition can't do without guessing a value that clips. */}
            <div className="grid grid-rows-[1fr] transition-all duration-300 ease-out border-t border-line">
              <div className="overflow-hidden p-5">
                {sourceMode === "paste" ? (
                  <textarea
                    value={draft.sourceText}
                    onChange={(e) => setDraft((d) => ({ ...d, sourceText: e.target.value }))}
                    onPaste={handlePasteSource}
                    placeholder={t.quote.pasteHere}
                    rows={9}
                    className="w-full font-body text-body leading-relaxed text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border resize-y whitespace-pre-wrap"
                  />
                ) : (
                  <DropZone
                    onFile={handleFile}
                    accept=".txt,.md,.pdf,.docx"
                    disabled={uploading}
                    className="flex flex-col gap-2 cursor-pointer bg-paper border border-dashed border-line rounded-lg px-4 py-6"
                  >
                    <span className="text-small text-text-muted">
                      {uploading
                        ? "Reading file..."
                        : fileName
                        ? `Loaded: ${fileName}`
                        : t.quote.dragFileHere}
                    </span>
                    <span className="font-body font-bold text-small text-violet">{t.quote.chooseFile}</span>
                  </DropZone>
                )}
              </div>
            </div>
          </div>

          <Card>
            <FieldHeading>{t.quote.visualReferences}</FieldHeading>
            <p className="text-meta text-text-muted mb-3">
              {t.quote.referencesHint}
            </p>
            <DropZone
              onFile={handleReferenceImage}
              accept="image/png,image/jpeg"
              disabled={imageUploading}
              className="flex items-center gap-1.5 cursor-pointer -m-1 p-1 mb-2"
            >
              <ImagePlus size={13} className="text-violet" />
              <span className="font-body font-bold text-small text-violet">
                {imageUploading ? "Reading image..." : "Drag an image, or click to add one"}
              </span>
            </DropZone>
            {references.length > 0 && (
              <div className="flex flex-col gap-2 mt-1">
                {references.map((ref, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-paper rounded-lg p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ref.dataUrl}
                      alt=""
                      className="w-14 h-14 rounded object-cover shrink-0"
                    />
                    <input
                      value={ref.caption}
                      onChange={(e) =>
                        setReferences((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, caption: e.target.value } : r))
                        )
                      }
                      placeholder={t.quote.whatShouldClientTake}
                      className="flex-1 self-center font-body text-xs text-ink bg-white border border-line rounded-lg px-2.5 py-2 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setReferences((prev) => prev.filter((_, j) => j !== i))}
                      className="text-text-muted hover:text-overdue bg-none border-none cursor-pointer p-1 shrink-0 self-center"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <FieldHeading>{t.quote.howShouldItRun}</FieldHeading>
            <p className="text-meta text-slate mb-3 leading-relaxed">
              {t.quote.howShouldItRunHint}
            </p>
            <TextField
              value={draft.instructions}
              onChange={(v) => setDraft((d) => ({ ...d, instructions: v }))}
              placeholder={t.quote.howShouldItRunPlaceholder}
              multiline
              rows={4}
            />
            {/* Chips, not links: a link appends every time it is clicked and
                gives no way to take it back, so clicking one twice put the
                same sentence in twice. */}
            <div className="mt-3">
              <div className="text-caption text-text-muted mb-1.5">{t.common.commonOnes}</div>
              <div className="flex flex-wrap gap-1.5">
                {projectPresetKeys(industry).map((exampleKey) => {
                  const example = t.quote[exampleKey];
                  const picked = pickedExamples.includes(example);
                  return (
                    <Chip
                      key={example}
                      active={picked}
                      onClick={() => {
                        setPickedExamples((prev) =>
                          picked ? prev.filter((e) => e !== example) : [...prev, example]
                        );
                        setDraft((d) => ({
                          ...d,
                          instructions: toggleExampleLine(d.instructions, example, !picked),
                        }));
                      }}
                    >
                      {example}
                    </Chip>
                  );
                })}
              </div>
            </div>
            <p className="text-caption text-text-muted mt-3 mb-0">
              {t.quote.workedOutFromBrief}
            </p>
          </Card>

          {/* Everything that used to be asked on every quote and is actually
              a property of the freelancer rather than of the job. Four
              readable lines, remembered after the first quote. See
              components/quote/setup-rows and lib/quote-defaults. */}
          <SetupRows
            draft={draft}
            setDraft={setDraft}
            sectionNotes={sectionNotes}
            setSectionNotes={setSectionNotes}
            availabilityNote={availabilityNote}
            setAvailabilityNote={setAvailabilityNote}
            saved={saved}
            hasBrand={hasBrand}
            rateHelpOpen={showRateHelp}
            setRateHelpOpen={setShowRateHelp}
            onKeep={handleKeepRow}
            keptRows={keptRows}
            brandUpload={brandUpload}
            pricedFor={pricedForFields}
          />

          {generating && (
            <div className="flex flex-col gap-2">
              <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet rounded-full transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-violet text-small font-body font-semibold">
                <Sparkles size={14} className="animate-spin-slow" />
                {statusMessage}
              </div>
            </div>
          )}

          {error && <div className="text-overdue text-small">{error}</div>}
          <div className="flex justify-end mt-auto pt-2">
            {generating ? (
              <Button variant="ghost" icon={CircleStop} onClick={handleStopGenerating}>
                {t.quote.stop}
              </Button>
            ) : (
              <Button icon={Sparkles} onClick={handleGenerate}>
                {t.quote.generate}
              </Button>
            )}
          </div>
        </>
      )}

    </>
  );
}
