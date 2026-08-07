"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, ChevronLeft, ArrowRight, Sparkles } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { generateBriefAction, type QuoteDraftPayload } from "@/actions/briefs";
import { industryQuoteExample } from "@/lib/industries";
import { CURRENCIES, currencySymbol } from "@/lib/currencies";

type BriefSummary = { id: string; title: string; status: "DRAFT" | "TRACKED" };

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "text-violet",
  TRACKED: "text-slate",
};

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
  projectTitles,
  recentBriefs,
  userIndustry,
  userCurrency,
}: {
  projectTitles: string[];
  recentBriefs: BriefSummary[];
  userIndustry?: string | null;
  userCurrency?: string | null;
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
  });
  const [sourceMode, setSourceMode] = useState<"paste" | "upload">("paste");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
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
    const result = await generateBriefAction(draft);
    setGenerating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/quote/${result.data.briefId}`);
  }

  return (
    <>
      {step === 0 && (
        <>
          <Topbar eyebrow="Quote — Step 1 of 3" />
          <div>
            <h1 className="font-display italic text-4xl text-coral m-0">
              What are we quoting?
            </h1>
            <p className="text-slate text-[15px] mt-2">
              Start from a brief the client sent you, or write one in from scratch.
            </p>
          </div>
          <Stepper activeIndex={0} />
          <div className="flex gap-5">
            <Card
              onClick={() => setSourceMode("upload")}
              className={`flex-1 cursor-pointer ${
                sourceMode === "upload" ? "border-violet border-[1.5px]" : ""
              }`}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center mb-3.5 ${
                  sourceMode === "upload" ? "bg-violet-tint" : "bg-paper"
                }`}
              >
                <Upload size={18} className={sourceMode === "upload" ? "text-violet" : "text-text-muted"} />
              </div>
              <div className="font-body font-semibold text-base mb-1.5 text-ink">Upload a brief</div>
              <div className="text-slate text-[13px]">
                Drop a PDF, DOCX, or text file. We&apos;ll read it and pull out the scope.
              </div>
            </Card>
            <Card
              onClick={() => setSourceMode("paste")}
              className={`flex-1 cursor-pointer ${
                sourceMode === "paste" ? "border-violet border-[1.5px]" : ""
              }`}
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center mb-3.5 ${
                  sourceMode === "paste" ? "bg-violet-tint" : "bg-paper"
                }`}
              >
                <FileText size={18} className={sourceMode === "paste" ? "text-violet" : "text-text-muted"} />
              </div>
              <div className="font-body font-semibold text-base mb-1.5 text-ink">Paste text</div>
              <div className="text-slate text-[13px]">
                Paste notes, a call transcript, or a scope you&apos;ve already typed up.
              </div>
            </Card>
          </div>
          {sourceMode === "paste" ? (
            <TextField
              value={draft.sourceText}
              onChange={(v) => setDraft((d) => ({ ...d, sourceText: v }))}
              placeholder="Paste the client's brief, email, or notes here..."
              multiline
              rows={8}
            />
          ) : (
            <Card>
              <label className="flex flex-col gap-2 cursor-pointer">
                <span className="text-[13px] text-text-muted">
                  {uploading
                    ? "Reading file..."
                    : fileName
                    ? `Loaded: ${fileName}`
                    : "Click to choose a file — .txt, .md, .pdf, and .docx are supported."}
                </span>
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                <span className="font-body font-bold text-[13px] text-violet">Choose file</span>
              </label>
            </Card>
          )}
          {error && <div className="text-overdue text-[13px]">{error}</div>}
          <div className="flex justify-end mt-auto">
            <Button
              icon={ArrowRight}
              disabled={!draft.sourceText.trim()}
              onClick={() => setStep(1)}
            >
              Continue
            </Button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <Topbar eyebrow="Quote — Step 2 of 3" />
          <div>
            <h1 className="font-display italic text-4xl text-coral m-0">How should we brief it?</h1>
            <p className="text-slate text-[15px] mt-2">
              Tell it what to lean on from memory, and how much to spell out.
            </p>
          </div>
          <Stepper activeIndex={1} />
          <Card>
            <Label>Instructions</Label>
            <TextField
              value={draft.instructions}
              onChange={(v) => setDraft((d) => ({ ...d, instructions: v }))}
              placeholder={industryQuoteExample(userIndustry)}
              multiline
            />
          </Card>
          <div className="flex gap-5">
            <Card className="flex-1">
              <Label>Pull from memory</Label>
              {projectTitles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {projectTitles.map((name) => {
                    const active = draft.memoryProjectTitles.includes(name);
                    return (
                      <Chip
                        key={name}
                        active={active}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            memoryProjectTitles: active
                              ? d.memoryProjectTitles.filter((n) => n !== name)
                              : [...d.memoryProjectTitles, name],
                          }))
                        }
                      >
                        {name}
                      </Chip>
                    );
                  })}
                </div>
              ) : (
                <div className="text-text-muted text-[12.5px]">
                  Nothing to pull from yet — once you&apos;ve tracked a few projects, they&apos;ll
                  show up here to reference for style.
                </div>
              )}
            </Card>
            <Card className="w-[300px]">
              <Label>Detail level</Label>
              <div className="flex bg-paper rounded-full p-[3px]">
                {(["Generic", "Detailed"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setDraft((d) => ({ ...d, detailLevel: lvl }))}
                    className={`flex-1 py-2.5 rounded-full border-none cursor-pointer font-body font-semibold text-xs ${
                      draft.detailLevel === lvl ? "bg-violet text-white" : "bg-transparent text-slate"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <div className="text-xs text-text-muted mt-2.5">
                Detailed spells out every deliverable and assumption — good for new clients.
              </div>
            </Card>
          </div>
          <div className="flex gap-5">
            <Card className="flex-1">
              <Label>Your hourly rate</Label>
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
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, hourlyRate: Number(e.target.value) }))
                  }
                  placeholder="e.g. 65"
                  className="w-full bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
                />
                <span className="text-slate text-sm">/hr</span>
              </div>
              <div className="text-xs text-text-muted mt-2.5">
                Used to reason about price and hours — always asked, so estimates stay tied to
                what you actually charge. Defaults to your saved currency from Memory →
                Branding.
              </div>
            </Card>
            <Card className="flex-1">
              <Label>Your expertise level</Label>
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
              <div className="text-xs text-text-muted mt-2.5">
                Only used if there&apos;s no pricing history to draw from yet — it helps Freely
                research a realistic market baseline instead of guessing.
              </div>
            </Card>
          </div>
          <div className="flex justify-between mt-auto">
            <Button variant="ghost" icon={ChevronLeft} onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              icon={ArrowRight}
              disabled={!draft.hourlyRate || draft.hourlyRate <= 0}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Topbar eyebrow="Quote — Step 3 of 3" />
          <div>
            <h1 className="font-display italic text-4xl text-coral m-0">How should we package it?</h1>
            <p className="text-slate text-[15px] mt-2">
              Pick a format and what gets included before we generate the brief.
            </p>
          </div>
          <Stepper activeIndex={2} />
          <div className="flex gap-5">
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
                    <div className="font-body font-semibold text-[15px] text-ink">
                      {fmt === "HTML" ? "HTML page" : fmt === "PDF" ? "PDF" : "Figma file"}
                    </div>
                    {disabled && (
                      <span className="font-body font-semibold text-[10px] uppercase tracking-wide text-text-muted bg-paper border border-line rounded-full px-2 py-0.5">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <div className="text-slate text-[12.5px] mt-1.5">
                    {fmt === "HTML"
                      ? "A hosted, linkable page the client can open in any browser. Works today."
                      : fmt === "PDF"
                      ? "A polished, downloadable document for print or email. Works today."
                      : "An editable file pushed to your Figma account — not yet built."}
                  </div>
                </Card>
              );
            })}
          </div>
          {(draft.format === "HTML" || draft.format === "PDF") && (
            <Card>
              <Label>{draft.format === "HTML" ? "Public page template" : "PDF template"}</Label>
              <div className="flex gap-4">
                {(
                  [
                    { id: "classic", name: "Classic", desc: "Dark cover, tinted sections, the default look." },
                    { id: "editorial", name: "Editorial", desc: "Large headline, magazine-style whitespace." },
                    { id: "minimal", name: "Minimal", desc: "Plain, high-contrast, hairline rules only." },
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
                    <div className="font-body font-semibold text-[13.5px] text-ink mt-2.5">{tpl.name}</div>
                    <div className="text-slate text-[11.5px] mt-1">{tpl.desc}</div>
                  </Card>
                ))}
              </div>
            </Card>
          )}
          <Card>
            <Label>Include in this quote</Label>
            <p className="text-xs text-text-muted mt-1 mb-3">
              All off by default — turn on only what this quote needs.
            </p>
            <div className="flex gap-2.5 flex-wrap">
              <Chip
                active={draft.includeStrategy}
                onClick={() => setDraft((d) => ({ ...d, includeStrategy: !d.includeStrategy }))}
              >
                Strategy
              </Chip>
              <Chip
                active={draft.includeTimeline}
                onClick={() => setDraft((d) => ({ ...d, includeTimeline: !d.includeTimeline }))}
              >
                Timeline
              </Chip>
              <Chip
                active={draft.includeSOW}
                onClick={() => setDraft((d) => ({ ...d, includeSOW: !d.includeSOW }))}
              >
                Statement of Work
              </Chip>
              <Chip
                active={draft.includeAI}
                onClick={() => setDraft((d) => ({ ...d, includeAI: !d.includeAI }))}
              >
                AI-use disclosure
              </Chip>
            </div>
          </Card>
          {error && <div className="text-overdue text-[13px]">{error}</div>}
          <div className="flex justify-between mt-auto">
            <Button variant="ghost" icon={ChevronLeft} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button icon={Sparkles} spinIcon={generating} disabled={generating} onClick={handleGenerate}>
              {generating ? "Generating..." : "Generate brief"}
            </Button>
          </div>
        </>
      )}

      {recentBriefs.length > 0 && step === 0 && (
        <Card>
          <Label>Brief history</Label>
          <div className="flex flex-col gap-2">
            {recentBriefs.slice(0, 6).map((b) => (
              <button
                key={b.id}
                onClick={() => router.push(`/quote/${b.id}`)}
                className="bg-none border-none text-left cursor-pointer p-0 flex justify-between gap-2"
              >
                <span className="text-[12.5px] text-slate">{b.title}</span>
                <span className={`font-body font-semibold text-[10px] ${STATUS_COLOR[b.status]}`}>
                  {b.status}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
