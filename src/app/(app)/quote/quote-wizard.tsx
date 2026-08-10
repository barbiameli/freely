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
import { industryQuoteExample } from "@/lib/industries";
import { CURRENCIES, currencySymbol } from "@/lib/currencies";
import { MAX_DOCUMENT_UPLOAD_BYTES, documentTooLargeError } from "@/lib/upload-limits";
import { BRANDING_OPTIONS } from "@/lib/branding";
import { INTERPRETATION_PRESETS, QUOTE_INCLUSIONS } from "@/lib/quote-prompts";
import { readPastedText } from "@/lib/paste-text";
import { BriefHistory } from "@/components/brief-history";
import {
  analyzeBrandGuideAction,
  analyzeBrandGuideImageAction,
  uploadBrandLogoAction,
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
    <span className="text-[11px] text-text-muted">{required ? "Required" : "Optional"}</span>
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
  userIndustry,
  userCurrency,
  hasBrand,
  savedLocation,
}: {
  recentBriefs: BriefSummary[];
  userIndustry?: string | null;
  userCurrency?: string | null;
  hasBrand?: boolean;
  savedLocation?: string;
}) {
  const router = useRouter();
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
    hourlyRate: 0,
    currency: userCurrency || "USD",
    expertiseLevel: "Senior",
    template: "classic",
    // Someone who has set up their own branding almost always wants to send
    // a quote under it, so that's the default whenever it's available.
    branding: hasBrand ? "own" : "freely",
    pricing: { yourLocation: savedLocation || "" },
  });
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
  const [appliedPresets, setAppliedPresets] = useState<string[]>([]);
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
    const formData = new FormData();
    formData.set("file", file);
    const res = await fetch("/api/extract-text", { method: "POST", body: formData });
    const result = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(result.error || "Couldn't read that file.");
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
      const result = await Promise.race([generateBriefAction(draft), timeout]);
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
          ? "This is taking longer than it should. It may still finish in the background, but don't wait on it. Try again, or simplify the source material first (a very large uploaded file slows this down a lot)."
          : "Something went wrong generating the brief. Try again."
      );
    }
  }

  /** Presets toggle. Several can be combined, anything typed by hand survives,
   * and clicking a selected one removes just that preset's text. Presets in
   * the same group replace each other, since two contradictory instructions
   * leave the result down to whichever the model happens to weight more. */
  function togglePreset(label: string, text: string) {
    const preset = INTERPRETATION_PRESETS.find((pr) => pr.label === label);
    const on = appliedPresets.includes(label);

    if (!on && preset?.group) {
      const conflicting = INTERPRETATION_PRESETS.filter(
        (pr) => pr.group === preset.group && pr.label !== label && appliedPresets.includes(pr.label)
      );
      for (const other of conflicting) {
        setAppliedPresets((prev) => prev.filter((l) => l !== other.label));
        setDraft((d) => ({
          ...d,
          instructions: d.instructions
            .split("\n")
            .filter((line) => line.trim() !== other.text)
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim(),
        }));
      }
    }

    setAppliedPresets((prev) => (on ? prev.filter((l) => l !== label) : [...prev, label]));
    setDraft((d) => {
      if (on) {
        // Remove that preset's exact text. If it isn't found (because it was
        // edited by hand) the chip still deselects, rather than silently
        // stripping something the user wrote.
        const without = d.instructions
          .split("\n")
          .filter((line) => line.trim() !== text)
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        return { ...d, instructions: without };
      }
      return {
        ...d,
        instructions: d.instructions.trim() ? `${d.instructions.trim()}\n${text}` : text,
      };
    });
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
        const formData = new FormData();
        formData.set("file", file);
        const res = await fetch("/api/extract-text", { method: "POST", body: formData });
        const extracted = await res.json();
        if (!res.ok) throw new Error(extracted.error || "Couldn't read that file.");
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
      setError(
        "Add your hourly rate, or say where you or the client are based so a rate can be researched."
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
          <Topbar eyebrow="Quote - Step 1 of 2" />
          <BriefHistory briefs={recentBriefs} />
          <div>
            <h1 className="font-display italic text-[30px] md:text-4xl text-coral m-0">
              What are we quoting?
            </h1>
            <p className="text-slate text-[15px] mt-2">
              Everything the quote gets built from. Only the brief and your rate are needed.
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
                    title: "Upload a brief",
                    blurb: "PDF, DOCX, or a text file.",
                  },
                  {
                    mode: "paste" as const,
                    icon: FileText,
                    title: "Paste text",
                    blurb: "Notes, a transcript, or a scope you've typed up.",
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
                        className={`block font-body font-semibold text-[14px] ${
                          selected ? "text-violet" : "text-ink"
                        }`}
                      >
                        {title}
                      </span>
                      <span className="block text-slate text-[12.5px] mt-0.5">{blurb}</span>
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
                    placeholder="Paste the client's brief, email, or notes here..."
                    rows={9}
                    className="w-full font-body text-[13.5px] leading-relaxed text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border resize-y whitespace-pre-wrap"
                  />
                ) : (
                  <DropZone
                    onFile={handleFile}
                    accept=".txt,.md,.pdf,.docx"
                    disabled={uploading}
                    className="flex flex-col gap-2 cursor-pointer bg-paper border border-dashed border-line rounded-lg px-4 py-6"
                  >
                    <span className="text-[13px] text-text-muted">
                      {uploading
                        ? "Reading file..."
                        : fileName
                        ? `Loaded: ${fileName}`
                        : "Drag a file here, or click to choose one (.txt, .md, .pdf, .docx)."}
                    </span>
                    <span className="font-body font-bold text-[13px] text-violet">Choose file</span>
                  </DropZone>
                )}
              </div>
            </div>
          </div>

          <Card>
            <FieldHeading>Visual references</FieldHeading>
            <p className="text-[12px] text-text-muted mb-3">
              Screenshots, moodboards, or examples of the kind of thing you mean. Attached to the quote so the client can see the direction.
            </p>
            <DropZone
              onFile={handleReferenceImage}
              accept="image/png,image/jpeg"
              disabled={imageUploading}
              className="flex items-center gap-1.5 cursor-pointer -m-1 p-1 mb-2"
            >
              <ImagePlus size={13} className="text-violet" />
              <span className="font-body font-bold text-[12.5px] text-violet">
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
                      placeholder="What should the client take from this?"
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
            <FieldHeading>How should this be read?</FieldHeading>
            <p className="text-[12px] text-text-muted mb-3">
              How you want the brief interpreted and the quote structured. Leave it empty and the AI decides from the brief and your past quotes. Pick as many as you like, contradictory ones cannot both be on.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {INTERPRETATION_PRESETS.map((preset) => (
                <Chip
                  key={preset.label}
                  active={appliedPresets.includes(preset.label)}
                  onClick={() => togglePreset(preset.label, preset.text)}
                >
                  {preset.label}
                </Chip>
              ))}
            </div>
            <TextField
              value={draft.instructions}
              onChange={(v) => setDraft((d) => ({ ...d, instructions: v }))}
              placeholder={industryQuoteExample(userIndustry)}
              multiline
              rows={4}
            />
          </Card>

          <div className="flex flex-col md:flex-row gap-4 md:gap-5">
            <Card className="flex-1">
              <FieldHeading>Your hourly rate</FieldHeading>
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
                  placeholder="e.g. 65"
                  className="w-full bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
                />
                <span className="text-slate text-sm">/hr</span>
              </div>
              <div className="text-[12px] text-text-muted mt-2.5">
                {draft.hourlyRate > 0
                  ? "The price is your rate times the hours. Your rate is used exactly as typed."
                  : "Leave it blank and a rate gets researched for your market."}
              </div>
            </Card>
            <Card className="flex-1">
              <FieldHeading>Your expertise level</FieldHeading>
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
              <div className="text-[12px] text-text-muted mt-2.5">
                Used when no rate is given, to research a realistic one.
              </div>
            </Card>
          </div>

          {draft.hourlyRate <= 0 && (
            <Card>
              <FieldHeading required>Where is this being priced for?</FieldHeading>
              <p className="text-[12px] text-text-muted mb-3">
                No hourly rate given, so one gets researched. The same job pays very differently
                from one market to the next, so a location is needed.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    {
                      key: "yourLocation" as const,
                      label: "Where you are based",
                      placeholder: "e.g. Buenos Aires, Argentina",
                    },
                    {
                      key: "clientLocation" as const,
                      label: "Where the client is",
                      placeholder: "e.g. London, UK",
                    },
                    {
                      key: "clientType" as const,
                      label: "What kind of client",
                      placeholder: "e.g. seed-stage startup",
                    },
                    {
                      key: "budgetHint" as const,
                      label: "Anything they said about budget",
                      placeholder: "e.g. mentioned around 5k",
                    },
                    {
                      key: "urgency" as const,
                      label: "Timing",
                      placeholder: "e.g. needs it in three weeks",
                    },
                    {
                      key: "experienceNote" as const,
                      label: "Done this kind of work before?",
                      placeholder: "e.g. twice, unpaid, for friends",
                    },
                  ]
                ).map((field) => (
                  <label key={field.key} className="block">
                    <span className="block text-[10.5px] font-bold text-slate uppercase tracking-wide mb-1">
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
                      className="w-full font-body text-[13px] text-ink bg-paper border border-line rounded-lg px-2.5 py-2 outline-none"
                    />
                  </label>
                ))}
              </div>
              <p className="text-[11.5px] text-text-muted mt-3">
                Your location or the client&apos;s is needed. The rest is optional. Where the client is
                usually matters most, since that is what sets what you can charge.
              </p>
            </Card>
          )}

          {error && <div className="text-overdue text-[13px]">{error}</div>}
          <div className="flex justify-end mt-auto pt-2">
            <Button icon={ArrowRight} onClick={goToOutputStep}>
              Continue
            </Button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <Topbar eyebrow="Quote - Step 2 of 2" />
          <div>
            <h1 className="font-display italic text-[30px] md:text-4xl text-coral m-0">How should we package it?</h1>
            <p className="text-slate text-[15px] mt-2">
              How the finished quote looks and what it includes.
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
            <FieldHeading required>Output</FieldHeading>
            <p className="text-[12px] text-text-muted mb-3">
              What the client receives, and how it looks.
            </p>

            <div className="text-[11px] font-bold text-slate uppercase tracking-wide mb-2">
              Page format
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
                      <div className="font-body font-semibold text-[13.5px] text-ink">
                        {fmt === "HTML" ? "HTML page" : fmt === "PDF" ? "PDF" : "Figma file"}
                      </div>
                      {disabled && (
                        <span className="font-body font-semibold text-[10px] uppercase tracking-wide text-text-muted bg-paper border border-line rounded-full px-2 py-0.5">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <div className="text-slate text-[11.5px] mt-1">
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
                <div className="text-[11px] font-bold text-slate uppercase tracking-wide mb-2">
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
                        <div className="font-body font-semibold text-[13px] text-ink">{opt.name}</div>
                        <div className="text-slate text-[11px] mt-1">{opt.desc}</div>
                        {disabled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowBrandUpload(true);
                            }}
                            className="text-violet text-[11px] font-bold mt-1.5 bg-none border-none cursor-pointer p-0"
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
                        <div className="font-body font-semibold text-[13px] text-ink">
                          Add your branding
                        </div>
                        <div className="text-slate text-[11.5px] mt-0.5">
                          A logo, a brand guide, or both. Saved to Memory and applied here.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBrandUpload(false)}
                        className="text-[11.5px] text-text-muted bg-none border-none cursor-pointer p-0"
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
                        <span className="flex items-center gap-1.5 font-body font-bold text-[12.5px] text-violet">
                          <FileText size={12} />
                          {brandBusy === "guide" ? "Reading..." : "Brand guidelines"}
                        </span>
                        <span className="text-[11px] text-text-muted">
                          PDF, DOCX, TXT, MD, PNG or JPG.
                        </span>
                      </DropZone>

                      <DropZone
                        onFile={handleBrandLogo}
                        accept="image/png"
                        disabled={brandBusy !== null}
                        className="flex-1 flex flex-col gap-1.5 cursor-pointer bg-white border border-dashed border-line rounded-lg px-3.5 py-3"
                      >
                        <span className="flex items-center gap-1.5 font-body font-bold text-[12.5px] text-violet">
                          <ImagePlus size={12} />
                          {brandBusy === "logo" ? "Uploading..." : "Logo"}
                        </span>
                        <span className="text-[11px] text-text-muted">Transparent PNG.</span>
                      </DropZone>
                    </div>

                    {brandError && <div className="text-overdue text-[12px] mt-2">{brandError}</div>}
                    {brandSaved && (
                      <div className="flex items-center gap-1.5 text-success text-[12px] mt-2">
                        <Check size={12} /> Saved. &quot;Your brand&quot; is ready to pick.
                      </div>
                    )}
                  </div>
                )}

                <div className="text-[11px] font-bold text-slate uppercase tracking-wide mb-2">
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
                      <div className="font-body font-semibold text-[13px] text-ink mt-2.5">
                        {tpl.name}
                      </div>
                      <div className="text-slate text-[11px] mt-1">{tpl.desc}</div>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card>
            <FieldHeading>Add sections</FieldHeading>
            <p className="text-[12px] text-text-muted mb-3">
              Every quote covers the scope, deliverables, and the price with the reasoning behind it. Add anything else this one needs.
            </p>
            <div className="flex flex-col gap-2">
              {QUOTE_INCLUSIONS.map((inc) => {
                const on = Boolean(draft[inc.key]);
                return (
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
                      <span className="font-body font-semibold text-[13.5px] text-ink block">
                        {inc.label}
                      </span>
                      <span className="text-[11.5px] text-slate">{inc.hint}</span>
                    </span>
                  </button>
                );
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
              <div className="flex items-center gap-2 text-violet text-[13px] font-body font-semibold">
                <Sparkles size={14} className="animate-spin-slow" />
                {statusMessage}
              </div>
            </div>
          )}
          {error && <div className="text-overdue text-[13px]">{error}</div>}
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
              Back
            </Button>
            {generating ? (
              <Button variant="ghost" icon={CircleStop} onClick={handleStopGenerating}>
                Stop
              </Button>
            ) : (
              <Button icon={Sparkles} onClick={handleGenerate}>
                Generate brief
              </Button>
            )}
          </div>
        </>
      )}

    </>
  );
}
