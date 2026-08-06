"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Check,
  Download,
  Link2,
  CheckCircle2,
  HelpCircle,
  Upload,
  Trash2,
  ImagePlus,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Stamp, type StampStatus } from "@/components/ui/stamp";
import {
  refineBriefAction,
  addBriefToTrackAction,
  setBriefPublishedAction,
  addBriefExampleAction,
  updateBriefExampleAction,
  deleteBriefExampleAction,
} from "@/actions/briefs";
import { currencySymbol } from "@/lib/currencies";

interface Strategy {
  goal: string;
  findings: string[];
  aiWill: string[];
  aiWillNot: string[];
  openQuestions: string[];
}

interface Example {
  id: string;
  name: string;
  dataUrl: string;
  caption: string;
}

interface Brief {
  id: string;
  title: string;
  client: string;
  scope: string;
  deliverables: string[];
  timeline: string;
  strategy?: Strategy | null;
  currency?: string | null;
  price: number;
  hours: number;
  hourlyRate?: number | null;
  status: StampStatus;
  createdAt: string;
  published: boolean;
  publicSlug: string;
  template?: string;
  sourceText?: string | null;
  examples: Example[];
}

/** A section card with an eyebrow label, a tinted background, and a colored
 * left rule — the "give every section a distinct block" treatment, so the
 * page reads as separated cards instead of one flat scroll of text. */
function Section({
  eyebrow,
  tint,
  accent,
  children,
}: {
  eyebrow: string;
  tint: "coral" | "violet" | "paper";
  accent: "coral" | "violet";
  children: React.ReactNode;
}) {
  const tintClass = tint === "coral" ? "bg-coral-tint" : tint === "violet" ? "bg-violet-tint" : "bg-paper";
  const accentClass = accent === "coral" ? "border-coral" : "border-violet";
  return (
    <div className={`${tintClass} rounded-card border-l-[3px] ${accentClass} px-5 py-4`}>
      <span className="font-body font-bold text-[10px] tracking-[0.08em] uppercase text-slate">
        {eyebrow}
      </span>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Bullets({ items, dense }: { items: string[]; dense?: boolean }) {
  return (
    <ul className={`list-none p-0 m-0 flex flex-col ${dense ? "gap-1.5" : "gap-2"}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-ink">
          <span className="text-coral font-bold shrink-0">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function BriefView({
  brief,
  history,
}: {
  brief: Brief;
  history: { id: string; title: string; status: string }[];
}) {
  const router = useRouter();
  const [refinePrompt, setRefinePrompt] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState(brief.published);
  const [publishing, setPublishing] = useState(false);

  const [showSource, setShowSource] = useState(false);
  const [examples, setExamples] = useState(brief.examples);
  const [exampleCaption, setExampleCaption] = useState("");
  const [exampleName, setExampleName] = useState("");
  const [exampleDataUrl, setExampleDataUrl] = useState("");
  const [addingExample, setAddingExample] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleTogglePublish() {
    setPublishing(true);
    const result = await setBriefPublishedAction(brief.id, !published);
    setPublishing(false);
    if (result.ok) setPublished(!published);
  }

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/q/${brief.publicSlug}` : `/q/${brief.publicSlug}`;

  async function handleRefine() {
    setWorking(true);
    setError("");
    const result = await refineBriefAction(brief.id, refinePrompt);
    setWorking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRefinePrompt("");
    router.refresh();
  }

  async function handleAddToTrack() {
    setWorking(true);
    await addBriefToTrackAction(brief.id);
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExampleName(file.name);
    const reader = new FileReader();
    reader.onload = () => setExampleDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleAddExample() {
    if (!exampleDataUrl || !exampleCaption.trim()) return;
    setAddingExample(true);
    const result = await addBriefExampleAction(brief.id, exampleName || "Example", exampleDataUrl, exampleCaption);
    setAddingExample(false);
    if (result.ok) {
      setExamples((prev) => [...prev, { id: result.data.id, name: exampleName || "Example", dataUrl: exampleDataUrl, caption: exampleCaption }]);
      setExampleName("");
      setExampleDataUrl("");
      setExampleCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteExample(id: string) {
    setExamples((prev) => prev.filter((e) => e.id !== id));
    await deleteBriefExampleAction(id);
  }

  async function handleCaptionBlur(id: string, caption: string) {
    await updateBriefExampleAction(id, { caption });
  }

  return (
    <>
      <Topbar eyebrow="Quote — Brief" />

      {/* Hero — mirrors a real quotation cover: dark block, big number stats */}
      <div className="bg-ink rounded-card px-7 py-6 flex justify-between items-start">
        <div>
          <span className="font-body font-bold text-[10px] tracking-[0.08em] uppercase text-coral">
            Quotation
          </span>
          <h1 className="font-display italic text-[28px] text-white m-0 mt-1">{brief.title}</h1>
          <p className="text-[13px] text-white/60 mt-1.5">
            {brief.client} · generated {new Date(brief.createdAt).toLocaleString()}
          </p>
          <div className="flex gap-7 mt-4">
            <div>
              <div className="font-body font-bold text-[20px] text-white">
                {currencySymbol(brief.currency)}
                {brief.price.toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-[0.06em] text-white/50">Total</div>
            </div>
            <div>
              <div className="font-body font-bold text-[20px] text-white">{brief.hours}h</div>
              <div className="text-[10px] uppercase tracking-[0.06em] text-white/50">Estimated hours</div>
            </div>
            {brief.hourlyRate && (
              <div>
                <div className="font-body font-bold text-[20px] text-white">
                  {currencySymbol(brief.currency)}
                  {brief.hourlyRate}
                </div>
                <div className="text-[10px] uppercase tracking-[0.06em] text-white/50">Per hour</div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2.5">
          <Stamp status={brief.status} size={56} />
          <button
            type="button"
            disabled={publishing}
            onClick={handleTogglePublish}
            className="flex items-center gap-1.5 bg-none border-none cursor-pointer p-0 text-[11.5px] font-semibold text-white/70 hover:text-white"
          >
            <Link2 size={12} />
            {publishing
              ? "Working..."
              : published
              ? "Live — unpublish"
              : "Publish as HTML page"}
          </button>
        </div>
      </div>

      <div className="flex gap-5 flex-1 min-h-0 mt-5">
        <div className="flex-[2] flex flex-col gap-4 overflow-y-auto pr-1">
          {brief.strategy && (
            <Section eyebrow="Strategy" tint="violet" accent="violet">
              <p className="text-sm leading-relaxed m-0 text-ink font-medium">{brief.strategy.goal}</p>
              {brief.strategy.findings.length > 0 && (
                <div className="mt-3">
                  <span className="text-[11px] font-bold text-slate uppercase tracking-[0.04em]">Findings</span>
                  <div className="mt-1.5">
                    <Bullets items={brief.strategy.findings} />
                  </div>
                </div>
              )}
              {brief.strategy.openQuestions.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate uppercase tracking-[0.04em]">
                    <HelpCircle size={13} /> Open questions
                  </div>
                  <div className="mt-1.5">
                    <Bullets items={brief.strategy.openQuestions} dense />
                  </div>
                </div>
              )}
            </Section>
          )}

          <Section eyebrow="Scope" tint="paper" accent="coral">
            <p className="text-sm leading-relaxed m-0 text-ink">{brief.scope}</p>
          </Section>

          <Section eyebrow="Deliverables" tint="coral" accent="coral">
            <div className="flex flex-col gap-2">
              {brief.deliverables.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-[13.5px] text-ink font-medium">
                  <CheckCircle2 size={14} className="text-coral shrink-0" />
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section eyebrow="Timeline" tint="paper" accent="violet">
            <p className="text-sm m-0 text-ink">{brief.timeline}</p>
          </Section>

          <div className="bg-ink rounded-card px-5 py-4 flex justify-between items-center">
            <div>
              <span className="font-body font-bold text-[10px] tracking-[0.08em] uppercase text-white/50">
                Investment
              </span>
              <p className="text-[13px] m-0 mt-1 text-white/80">
                {brief.hours} hours
                {brief.hourlyRate ? ` · ~${currencySymbol(brief.currency)}${brief.hourlyRate}/hr` : ""}
              </p>
            </div>
            <span className="font-body font-bold text-[24px] text-white">
              {currencySymbol(brief.currency)}
              {brief.price.toLocaleString()}
            </span>
          </div>

          {/* Examples — reference files with a note on how they apply, e.g.
              "this is a landing page I built, I'd apply a similar structure
              here" or "this moodboard is the visual direction I'd take it in." */}
          <Section eyebrow="Examples" tint="paper" accent="coral">
            {examples.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                {examples.map((ex) => (
                  <div key={ex.id} className="bg-white rounded-lg overflow-hidden border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ex.dataUrl} alt={ex.name} className="w-full h-[110px] object-cover" />
                    <div className="p-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[11px] font-bold text-ink">{ex.name}</span>
                        <button
                          onClick={() => handleDeleteExample(ex.id)}
                          className="bg-none border-none cursor-pointer p-0 text-slate hover:text-overdue"
                          aria-label="Remove example"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <textarea
                        defaultValue={ex.caption}
                        onBlur={(e) => handleCaptionBlur(ex.id, e.target.value)}
                        placeholder="How does this apply? e.g. this is a landing page I built — I'd apply a similar structure here."
                        className="w-full mt-1.5 text-[12px] leading-snug text-slate bg-paper rounded p-1.5 border border-line resize-none"
                        rows={3}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-white rounded-lg p-3 border border-dashed border-line">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePicked} className="hidden" id="example-file" />
              <label
                htmlFor="example-file"
                className="flex items-center gap-2 text-[12.5px] text-slate cursor-pointer"
              >
                <ImagePlus size={14} />
                {exampleName ? exampleName : "Upload a screenshot, moodboard, or past work sample"}
              </label>
              <textarea
                value={exampleCaption}
                onChange={(e) => setExampleCaption(e.target.value)}
                placeholder={`Explain how it applies — e.g. "This is a landing page I built for a past client. I'd apply a similar structure and layout here."`}
                className="w-full mt-2 text-[12.5px] leading-snug bg-paper rounded p-2 border border-line resize-none"
                rows={2}
              />
              <div className="mt-2">
                <Button
                  variant="outline"
                  icon={Upload}
                  disabled={addingExample || !exampleDataUrl || !exampleCaption.trim()}
                  onClick={handleAddExample}
                >
                  {addingExample ? "Adding..." : "Add example"}
                </Button>
              </div>
            </div>
          </Section>
        </div>

        <div className="w-[300px] flex flex-col gap-[18px]">
          <Card>
            <Label>Refine</Label>
            <TextField
              value={refinePrompt}
              onChange={setRefinePrompt}
              placeholder='e.g. "trim the timeline to 4 weeks"'
            />
            <div className="mt-2.5">
              <Button
                icon={Sparkles}
                spinIcon={working}
                disabled={working || !refinePrompt.trim()}
                onClick={handleRefine}
                className="w-full justify-center"
              >
                {working ? "Working..." : "Regenerate"}
              </Button>
            </div>
            {error && <div className="text-overdue text-xs mt-2">{error}</div>}
          </Card>
          {brief.sourceText && (
            <Card>
              <button
                type="button"
                onClick={() => setShowSource((s) => !s)}
                className="flex items-center justify-between w-full bg-none border-none cursor-pointer p-0"
              >
                <span className="flex items-center gap-1.5">
                  <FileText size={13} className="text-slate" />
                  <Label>Original request</Label>
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate transition-transform ${showSource ? "rotate-180" : ""}`}
                />
              </button>
              {showSource && (
                <p className="text-[12.5px] leading-relaxed text-slate mt-2.5 max-h-[220px] overflow-y-auto whitespace-pre-line">
                  {brief.sourceText}
                </p>
              )}
            </Card>
          )}
          <Card className="flex-1 overflow-y-auto">
            <Label>Brief history</Label>
            <div className="flex flex-col gap-2.5">
              {history.map((b) => (
                <button
                  key={b.id}
                  onClick={() => router.push(`/quote/${b.id}`)}
                  className="bg-none border-none text-left cursor-pointer p-0 flex justify-between gap-2"
                >
                  <span
                    className={`text-xs ${
                      b.id === brief.id ? "font-bold text-ink" : "font-medium text-slate"
                    }`}
                  >
                    {b.title}
                  </span>
                  <span className="font-body font-semibold text-[10px] text-violet">
                    {b.status}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
      {published && (
        <div className="flex items-center gap-2 bg-mint-solid rounded-lg px-4 py-2.5 text-[13px] text-success">
          <Link2 size={14} />
          Live at{" "}
          <a href={shareUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
            {shareUrl}
          </a>
        </div>
      )}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => router.push("/quote")}>
          New quote
        </Button>
        <a href={`/api/briefs/${brief.id}/pdf?template=${brief.template || "classic"}`} download>
          <Button variant="outline" icon={Download}>
            Download PDF
          </Button>
        </a>
        {brief.status === "DRAFT" && (
          <Button icon={Check} disabled={working} onClick={handleAddToTrack}>
            Add to Track
          </Button>
        )}
      </div>
    </>
  );
}
