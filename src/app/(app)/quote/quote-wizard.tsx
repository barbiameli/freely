"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  ChevronLeft,
  ArrowRight,
  Sparkles,
  CircleStop,
  ImagePlus,
  Trash2,
  Check,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { DropZone } from "@/components/ui/drop-zone";
import {
  generateBriefAction,
  addBriefExampleAction,
  type QuoteDraftPayload,
} from "@/actions/briefs";
import { CURRENCIES, currencySymbol } from "@/lib/currencies";
import { rateSuffix, parseRateUnit, type RateUnit } from "@/lib/rate-unit";
import { useT, useLocale } from "@/lib/i18n/context";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n";
import { MAX_DOCUMENT_UPLOAD_BYTES, documentTooLargeError } from "@/lib/upload-limits";
import { BRANDING_OPTIONS } from "@/lib/branding";
import {
  PROJECT_PREFERENCE_KEYS,
  QUOTE_INCLUSIONS,
  SECTION_QUESTIONS,
  sectionNoteLines,
  toggleExampleLine,
  availabilityFacts,
  type SectionNotes,
} from "@/lib/quote-prompts";
import { readPastedText } from "@/lib/paste-text";
import { extractFileText } from "@/lib/extract-file";
import { BriefHistory } from "@/components/brief-history";
import {
  analyzeBrandGuideAction,
  analyzeBrandGuideImageAction,
  uploadBrandLogoAction,
  updateDefaultRateAction,
} from "@/actions/memory";

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
  return (
    <span className="text-caption text-text-muted">{required ? "Required" : "Optional"}</span>
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

/** A tiny mocked-up page thumbnail so users can see roughly what each
 * template looks like, instead of just reading a name and description. */
function TemplatePreview({ id }: { id: "classic" | "editorial" | "minimal" }) {
  if (id === "classic") {
    return (
      <div className="w-full h-20 rounded-md bg-white border border-line overflow-hidden flex flex-col">
        <div className="bg-ink h-8 px-2.5 flex flex-col justify-center gap-1">
          <div className="w-8 h-[3px] bg-coral rounded-full" />
          <div className="w-14 h-[5px] bg-white/90 rounded-full" />
        </div>
        <div className="flex-1 px-2.5 py-2 flex flex-col gap-1.5">
          <div className="w-full h-2 rounded bg-violet-tint" />
          <div className="w-4/5 h-2 rounded bg-coral-tint" />
        </div>
      </div>
    );
  }
  if (id === "editorial") {
    return (
      <div className="w-full h-20 rounded-md bg-white border border-line overflow-hidden px-2.5 py-2.5 flex flex-col gap-1.5">
        <div className="w-10 h-[3px] bg-coral rounded-full" />
        <div className="w-16 h-3 bg-ink/80 rounded-sm" />
        <div className="w-full h-[2px] bg-coral mt-0.5" />
        <div className="w-full h-1.5 rounded bg-line mt-1" />
        <div className="w-3/5 h-1.5 rounded bg-line" />
      </div>
    );
  }
  return (
    <div className="w-full h-20 rounded-md bg-white border border-line overflow-hidden px-2.5 py-2.5 flex flex-col gap-1.5">
      <div className="w-full h-[3px] bg-ink" />
      <div className="w-12 h-2 bg-ink/70 rounded-sm mt-1" />
      <div className="w-full h-1 rounded bg-line mt-1.5" />
      <div className="w-2/3 h-1 rounded bg-line" />
    </div>
  );
}

export function QuoteWizard({
  recentBriefs,
  userCurrency,
  hasBrand,
  savedLocation,
  savedRate,
  savedRateUnit,
}: {
  recentBriefs: BriefSummary[];
  userCurrency?: string | null;
  hasBrand?: boolean;
  savedLocation?: string;
  /** The rate saved in Memory, prefilled so it is not retyped each time. */
  savedRate?: number;
  savedRateUnit?: string;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<QuoteDraftPayload>({
    sourceText: "",
    instructions: "",
    memoryProjectTitles: [],
    detailLevel: "Detailed",
    format: "HTML",
    includeSOW: false,
    includeAI: false,
    includeStrategy: false,
    includeTimeline: false,
    hourlyRate: savedRate ?? 0,
    rateUnit: parseRateUnit(savedRateUnit),
    currency: userCurrency || "USD",
    expertiseLevel: "Senior",
    template: "classic",
    // Someone who has set up their own branding almost always wants to send
    // a quote under it, so that's the default whenever it's available.
    branding: hasBrand ? "own" : "freely",
    pricing: { yourLocation: savedLocation || "" },
    // Defaults to the interface language, since most quotes go out in the
    // language the freelancer works in, and is changed per quote when they do
    // not match.
    language: locale,
  });
  const [availabilityNote, setAvailabilityNote] = useState("");
  // One optional question per section that rests on a decision only the
  // freelancer can make. See SECTION_QUESTIONS.
  const [sectionNotes, setSectionNotes] = useState<SectionNotes>({});
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
  const [rememberRate, setRememberRate] = useState(false);
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
      // Not awaited: failing to remember a rate is no reason to hold up
      // someone's quote.
      if (rememberRate && draft.hourlyRate > 0) {
        void updateDefaultRateAction({
          rate: draft.hourlyRate,
          unit: (draft.rateUnit ?? "HOUR") as RateUnit,
          currency: draft.currency,
        });
      }
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

  // Step navigation validates and explains, rather than leaving Continue
  // disabled with no indication of what's missing. A greyed-out button that
  // won't say why is the least helpful possible failure state.
  function goToOutputStep() {
    // Either they price the work, or they say where it is being priced for.
    if (
      (!draft.hourlyRate || draft.hourlyRate <= 0) &&
      !draft.pricing?.yourLocation?.trim() &&
      !draft.pricing?.clientLocation?.trim()
    ) {
      setShowRateHelp(true);
      setError(
        t.quote.addRateOrLocationLong
      );
      return;
    }
    setError("");
    setStep(1);
  }

  function handleStopGenerating() {
    cancelledRef.current = true;
    clearGenerationTimers();
    setGenerating(false);
    setError("Generation stopped. Change anything above and try again whenever you're ready.");
  }

  return (
    <>
      {step === 0 && (
        <>
          <Topbar eyebrow={t.quote.eyebrowStep1} />
          <BriefHistory briefs={recentBriefs} />
          <div>
            <h1 className="font-display italic text-[30px] md:text-4xl text-coral m-0">
              {t.quote.titleStep1}
            </h1>
            <p className="text-slate text-lead mt-2">
              {t.quote.subtitleStep1}
            </p>
          </div>
          <Stepper activeIndex={0} />
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
              Screenshots, moodboards, or examples of the kind of thing you mean. Attached to the quote so the client can see the direction.
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
                {PROJECT_PREFERENCE_KEYS.map((exampleKey) => {
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

          <div className="flex flex-col md:flex-row gap-4 md:gap-5">
            <Card className="flex-1">
              <FieldHeading>{t.quote.yourRate}</FieldHeading>
              {/* Plenty of freelancers price in days, and converting to an
                  hourly figure to fit the form means inventing a day length. */}
              <div className="flex gap-1.5 mb-2.5">
                {(
                  [
                    ["HOUR", t.quote.perHour],
                    ["DAY", t.quote.perDay],
                  ] as const
                ).map(([unit, label]) => (
                  <Chip
                    key={unit}
                    active={(draft.rateUnit ?? "HOUR") === unit}
                    onClick={() => setDraft((d) => ({ ...d, rateUnit: unit }))}
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
                  placeholder={(draft.rateUnit ?? "HOUR") === "DAY" ? "e.g. 520" : "e.g. 65"}
                  className="w-full bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
                />
                <span className="text-slate text-sm">
                  {rateSuffix((draft.rateUnit ?? "HOUR") as RateUnit)}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
                <span className="text-meta text-text-muted">
                  {draft.hourlyRate > 0 ? t.quote.usedAsTyped : t.quote.orResearched}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowRateHelp((v) => !v);
                    if (!showRateHelp) setDraft((d) => ({ ...d, hourlyRate: 0 }));
                  }}
                  className="text-meta font-semibold text-violet bg-none border-none cursor-pointer p-0"
                >
                  {showRateHelp ? t.quote.iKnowMyRate : t.quote.notSureWhatToCharge}
                </button>
              </div>
              {draft.hourlyRate > 0 && draft.hourlyRate !== savedRate && (
                <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberRate}
                    onChange={(e) => setRememberRate(e.target.checked)}
                    className="accent-violet"
                  />
                  <span className="text-meta text-slate">{t.quote.rememberThisRate}</span>
                </label>
              )}
            </Card>
            <Card className="flex-1">
              <FieldHeading>{t.quote.expertise}</FieldHeading>
              <div className="flex flex-wrap gap-2">
                {(["Junior", "Mid-level", "Senior", "Expert"] as const).map((lvl) => (
                  <Chip
                    key={lvl}
                    active={draft.expertiseLevel === lvl}
                    onClick={() => setDraft((d) => ({ ...d, expertiseLevel: lvl }))}
                  >
                    {lvl}
                  </Chip>
                ))}
              </div>
              <div className="text-meta text-text-muted mt-2.5">
                {t.quote.expertiseHint}
              </div>
            </Card>
          </div>

          {showRateHelp && (
            <Card>
              <FieldHeading required>{t.quote.pricedFor}</FieldHeading>
              <p className="text-meta text-text-muted mb-3">
                {t.quote.pricedForHint}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    {
                      key: "yourLocation" as const,
                      label: t.quote.yourLocation,
                      placeholder: "e.g. Buenos Aires, Argentina",
                    },
                    {
                      key: "clientLocation" as const,
                      label: t.quote.clientLocation,
                      placeholder: "e.g. London, UK",
                    },
                    {
                      key: "clientType" as const,
                      label: t.quote.clientType,
                      placeholder: "e.g. seed-stage startup",
                    },
                    {
                      key: "budgetHint" as const,
                      label: t.quote.budgetHint,
                      placeholder: "e.g. mentioned around 5k",
                    },
                    {
                      key: "urgency" as const,
                      label: t.quote.urgency,
                      placeholder: "e.g. needs it in three weeks",
                    },
                    {
                      key: "experienceNote" as const,
                      label: t.quote.experienceNote,
                      placeholder: "e.g. twice, unpaid, for friends",
                    },
                  ]
                ).map((field) => (
                  <label key={field.key} className="block">
                    <span className="block text-caption font-bold text-slate uppercase tracking-wide mb-1">
                      {field.label}
                    </span>
                    <input
                      value={draft.pricing?.[field.key] || ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          pricing: { ...d.pricing, [field.key]: e.target.value },
                        }))
                      }
                      placeholder={field.placeholder}
                      className="w-full font-body text-small text-ink bg-paper border border-line rounded-lg px-2.5 py-2 outline-none"
                    />
                  </label>
                ))}
              </div>
              <p className="text-meta text-text-muted mt-3">
                {t.quote.pricedForFooter}
              </p>
            </Card>
          )}

          {error && <div className="text-overdue text-small">{error}</div>}
          <div className="flex justify-end mt-auto pt-2">
            <Button icon={ArrowRight} onClick={goToOutputStep}>
              {t.common.continue}
            </Button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <Topbar eyebrow={t.quote.eyebrowStep2} />
          <div>
            <h1 className="font-display italic text-[30px] md:text-4xl text-coral m-0">
              {t.quote.titleStep2}
            </h1>
            <p className="text-slate text-lead mt-2">
              {t.quote.subtitleStep2}
            </p>
          </div>
          <Stepper
            activeIndex={1}
            onStepClick={() => {
              if (generating) handleStopGenerating();
              setError("");
              setStep(0);
            }}
          />

          <Card>
            <FieldHeading required>{t.quote.output}</FieldHeading>
            <p className="text-meta text-text-muted mb-3">
              {t.quote.outputHint}
            </p>

            {/* Separate from the interface language: a Spanish freelancer
                often has English clients, and the reverse. */}
            <div className="text-caption font-bold text-slate uppercase tracking-wide mb-2">
              {t.quote.quoteLanguage}
            </div>
            <div className="flex gap-1.5 mb-1.5">
              {LOCALES.map((code) => (
                <Chip
                  key={code}
                  active={(draft.language ?? locale) === code}
                  onClick={() => setDraft((d) => ({ ...d, language: code as Locale }))}
                >
                  {LOCALE_NAMES[code]}
                </Chip>
              ))}
            </div>
            <p className="text-caption text-text-muted mb-5">{t.quote.quoteLanguageHint}</p>

            <div className="text-caption font-bold text-slate uppercase tracking-wide mb-2">
              {t.quote.pageFormat}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {(["HTML", "PDF", "Figma"] as const).map((fmt) => {
                const disabled = fmt === "Figma";
                return (
                  <Card
                    key={fmt}
                    onClick={disabled ? undefined : () => setDraft((d) => ({ ...d, format: fmt }))}
                    className={`flex-1 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${
                      draft.format === fmt ? "border-violet border-[1.5px]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-body font-semibold text-body text-ink">
                        {fmt === "HTML" ? "HTML page" : fmt === "PDF" ? "PDF" : "Figma file"}
                      </div>
                      {disabled && (
                        <span className="font-body font-semibold text-caption uppercase tracking-wide text-text-muted bg-paper border border-line rounded-full px-2 py-0.5">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <div className="text-slate text-meta mt-1">
                      {fmt === "HTML"
                        ? "A hosted link the client opens in any browser."
                        : fmt === "PDF"
                        ? "A downloadable document for print or email."
                        : "Pushed to your Figma account, not yet built."}
                    </div>
                  </Card>
                );
              })}
            </div>

            {(draft.format === "HTML" || draft.format === "PDF") && (
              <>
                <div className="text-caption font-bold text-slate uppercase tracking-wide mb-2">
                  Branding
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                  {BRANDING_OPTIONS.map((opt) => {
                    const disabled = opt.id === "own" && !hasBrand;
                    return (
                      <Card
                        key={opt.id}
                        onClick={
                          disabled ? undefined : () => setDraft((d) => ({ ...d, branding: opt.id }))
                        }
                        className={`flex-1 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${
                          draft.branding === opt.id ? "border-violet border-[1.5px]" : ""
                        }`}
                      >
                        <div className="font-body font-semibold text-small text-ink">{opt.name}</div>
                        <div className="text-slate text-caption mt-1">{opt.desc}</div>
                        {disabled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowBrandUpload(true);
                            }}
                            className="text-violet text-caption font-bold mt-1.5 bg-none border-none cursor-pointer p-0"
                          >
                            Add your branding
                          </button>
                        )}
                      </Card>
                    );
                  })}
                </div>

                {showBrandUpload && (
                  <div className="bg-paper border border-line rounded-lg p-4 mb-5">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="font-body font-semibold text-small text-ink">
                          Add your branding
                        </div>
                        <div className="text-slate text-meta mt-0.5">
                          A logo, a brand guide, or both. Saved to Memory and applied here.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBrandUpload(false)}
                        className="text-meta text-text-muted bg-none border-none cursor-pointer p-0"
                      >
                        Close
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 mt-3">
                      <DropZone
                        onFile={handleBrandGuide}
                        accept=".pdf,.docx,.txt,.md,image/png,image/jpeg"
                        disabled={brandBusy !== null}
                        className="flex-1 flex flex-col gap-1.5 cursor-pointer bg-white border border-dashed border-line rounded-lg px-3.5 py-3"
                      >
                        <span className="flex items-center gap-1.5 font-body font-bold text-small text-violet">
                          <FileText size={12} />
                          {brandBusy === "guide" ? "Reading..." : "Brand guidelines"}
                        </span>
                        <span className="text-caption text-text-muted">
                          PDF, DOCX, TXT, MD, PNG or JPG.
                        </span>
                      </DropZone>

                      <DropZone
                        onFile={handleBrandLogo}
                        accept="image/png"
                        disabled={brandBusy !== null}
                        className="flex-1 flex flex-col gap-1.5 cursor-pointer bg-white border border-dashed border-line rounded-lg px-3.5 py-3"
                      >
                        <span className="flex items-center gap-1.5 font-body font-bold text-small text-violet">
                          <ImagePlus size={12} />
                          {brandBusy === "logo" ? t.quote.uploading : t.quote.logo}
                        </span>
                        <span className="text-caption text-text-muted">{t.quote.transparentPng}</span>
                      </DropZone>
                    </div>

                    {brandError && <div className="text-overdue text-meta mt-2">{brandError}</div>}
                    {brandSaved && (
                      <div className="flex items-center gap-1.5 text-success text-meta mt-2">
                        <Check size={12} /> Saved. &quot;Your brand&quot; is ready to pick.
                      </div>
                    )}
                  </div>
                )}

                <div className="text-caption font-bold text-slate uppercase tracking-wide mb-2">
                  Style
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(
                    [
                      { id: "classic", name: "Classic", desc: "Dark cover, tinted sections." },
                      { id: "editorial", name: "Editorial", desc: "Large headline, lots of air." },
                      { id: "minimal", name: "Minimal", desc: "Plain, hairline rules only." },
                    ] as const
                  ).map((tpl) => (
                    <Card
                      key={tpl.id}
                      onClick={() => setDraft((d) => ({ ...d, template: tpl.id }))}
                      className={`flex-1 cursor-pointer ${
                        draft.template === tpl.id ? "border-violet border-[1.5px]" : ""
                      }`}
                    >
                      <TemplatePreview id={tpl.id} />
                      <div className="font-body font-semibold text-small text-ink mt-2.5">
                        {tpl.name}
                      </div>
                      <div className="text-slate text-caption mt-1">{tpl.desc}</div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card>
            <FieldHeading>{t.quote.addSections}</FieldHeading>
            <p className="text-meta text-slate mb-3 leading-relaxed">
              {t.quote.addSectionsHint}
            </p>
            <div className="flex flex-col gap-2">
              {QUOTE_INCLUSIONS.map((inc) => {
                const on = Boolean(draft[inc.key]);
                const toggle = (
                  <button
                    key={inc.key}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, [inc.key]: !d[inc.key] }))}
                    className={`flex items-start gap-3 text-left rounded-lg px-3.5 py-3 cursor-pointer border ${
                      on ? "border-violet bg-violet-tint" : "border-line bg-paper"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-[5px] shrink-0 mt-0.5 flex items-center justify-center ${
                        on ? "bg-violet" : "bg-white border border-line"
                      }`}
                    >
                      {on && <Check size={11} className="text-white" />}
                    </span>
                    <span>
                      <span className="font-body font-semibold text-body text-ink block">
                        {t.quote[inc.labelKey]}
                      </span>
                      <span className="text-meta text-slate">{t.quote[inc.hintKey]}</span>
                    </span>
                  </button>
                );

                // Nothing in the brief can answer this, so it asks. One field
                // rather than a form about your own calendar.
                if (inc.key === "includeAvailability" && on) {
                  return (
                    <div key={inc.key} className="flex flex-col gap-2">
                      {toggle}
                      <div className="rounded-lg border border-line bg-white px-3.5 py-3 sm:ml-7">
                        <p className="text-meta text-slate mt-0 mb-2 leading-relaxed">
                          {t.quote.availabilityPrompt}
                        </p>
                        <TextField
                          value={availabilityNote}
                          onChange={setAvailabilityNote}
                          placeholder={t.quote.availabilityPlaceholder}
                          multiline
                          rows={2}
                        />
                        <p className="text-caption text-text-muted mt-2 mb-0">
                          {t.quote.availabilitySkipped}
                        </p>
                      </div>
                    </div>
                  );
                }

                // Sections that rest on a decision the model cannot read out
                // of the brief get one question each.
                const question = SECTION_QUESTIONS.find((q) => q.inclusion === inc.key);
                if (question && on) {
                  return (
                    <div key={inc.key} className="flex flex-col gap-2">
                      {toggle}
                      <div className="rounded-lg border border-line bg-white px-3.5 py-3 sm:ml-7">
                        <p className="text-meta text-slate mt-0 mb-2">{t.quote[question.promptKey]}</p>
                        <TextField
                          value={sectionNotes[question.key] ?? ""}
                          onChange={(v) =>
                            setSectionNotes((n) => ({ ...n, [question.key]: v }))
                          }
                          placeholder={t.quote[question.placeholderKey]}
                        />
                      </div>
                    </div>
                  );
                }

                return toggle;
              })}
            </div>
          </Card>

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
          <div className="flex flex-wrap justify-between items-center gap-3 mt-auto">
            <Button
              variant="ghost"
              icon={ChevronLeft}
              onClick={() => {
                if (generating) handleStopGenerating();
                // Step 0 is the brief. This said setStep(1) when the wizard
                // had three steps and step 1 was the middle one, so after the
                // condensation Back set the step it was already on.
                setError("");
                setStep(0);
              }}
            >
              {t.common.back}
            </Button>
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
