"use client";

import { useState, useTransition } from "react";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { INDUSTRY_OPTIONS } from "@/lib/industries";
import {
  type Preset,
  INSTRUCTIONS_PRESETS,
  TONE_PRESETS,
  STORY_PRESETS,
  CONTEXT_PRESETS,
} from "@/lib/memory-presets";
import { completeOnboardingAction } from "@/actions/onboarding";
import { saveMemoryFileAction, saveMemoryLinkAction, deleteMemoryAssetAction } from "@/actions/memory";
import { ArrowRight, TriangleAlert, Upload, Trash2, FileText, Link2 } from "lucide-react";

type StepId = "industry" | "instructions" | "toneNotes" | "storyNotes" | "contextNotes";

const MEMORY_STEPS: {
  id: StepId;
  title: string;
  subtitle: string;
  placeholder: string;
  presets: Preset[];
}[] = [
  {
    id: "instructions",
    title: "How should quotes be written?",
    subtitle: "Instructions Freely follows on every quote — tone, structure, level of detail.",
    placeholder: "e.g. spell out every deliverable explicitly, keep it lean and fast, write for a non-technical client...",
    presets: INSTRUCTIONS_PRESETS,
  },
  {
    id: "toneNotes",
    title: "What voice should it write in?",
    subtitle: "A short note on tone — Freely applies this to every quote's language.",
    placeholder: "e.g. warm but efficient, no exclamation points, avoid jargon...",
    presets: TONE_PRESETS,
  },
  {
    id: "storyNotes",
    title: "What's your studio's story?",
    subtitle: "How you started, what you're known for — used to build your AI persona and inform tone.",
    placeholder: "How the studio started, what you're known for, values that should come through in quotes...",
    presets: STORY_PRESETS,
  },
  {
    id: "contextNotes",
    title: "Anything else worth knowing?",
    subtitle: "Rates, typical engagement length, industries you specialize in — anything that should shape pricing or scope.",
    placeholder: "Anything else Claude should know — rates, typical engagement length, industries you specialize in...",
    presets: CONTEXT_PRESETS,
  },
];

export function OnboardingForm() {
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState<string | null>(null);
  const [values, setValues] = useState<Record<StepId, string>>({
    industry: "",
    instructions: "",
    toneNotes: "",
    storyNotes: "",
    contextNotes: "",
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const totalSteps = 2 + MEMORY_STEPS.length;
  const onIndustryStep = step === 0;
  const onReferencesStep = step === 1;
  const memoryStep = onIndustryStep || onReferencesStep ? null : MEMORY_STEPS[step - 2];

  function finish() {
    if (!industry) return;
    setError("");
    startTransition(async () => {
      try {
        await completeOnboardingAction({
          industry,
          instructions: values.instructions,
          toneNotes: values.toneNotes,
          storyNotes: values.storyNotes,
          contextNotes: values.contextNotes,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function goNext() {
    if (step >= totalSteps - 1) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-violet" : "bg-line"}`}
          />
        ))}
      </div>

      {onIndustryStep ? (
        <>
          <div className="flex flex-wrap gap-2.5">
            {INDUSTRY_OPTIONS.map((opt) => (
              <Chip key={opt.key} active={industry === opt.key} onClick={() => setIndustry(opt.key)}>
                {opt.label}
              </Chip>
            ))}
          </div>
          {error && <div className="text-overdue text-xs">{error}</div>}
          <Button
            icon={ArrowRight}
            disabled={!industry}
            onClick={goNext}
            className="justify-center"
          >
            Continue
          </Button>
        </>
      ) : onReferencesStep ? (
        <ReferencesStep onContinue={goNext} isLast={step === totalSteps - 1} />
      ) : (
        memoryStep && (
          <MemoryStep
            key={memoryStep.id}
            title={memoryStep.title}
            subtitle={memoryStep.subtitle}
            placeholder={memoryStep.placeholder}
            presets={memoryStep.presets}
            value={values[memoryStep.id]}
            onChange={(v) => setValues((prev) => ({ ...prev, [memoryStep.id]: v }))}
            onContinue={goNext}
            isLast={step === totalSteps - 1}
            pending={pending}
            error={error}
          />
        )
      )}
    </div>
  );
}

interface RefFile {
  id: string;
  name: string;
}
interface RefLink {
  id: string;
  name: string;
  url: string;
}

/** The most load-bearing onboarding step: real material about how this
 * freelancer actually works, not just preferences. A CV, portfolio link,
 * a past quote, a case study — each one gives Claude something concrete to
 * draw on instead of writing generic filler. Reuses the same Memory-asset
 * actions the Memory page's "Files, images & links" section uses, so
 * anything added here shows up there too (and vice versa, later). */
function ReferencesStep({ onContinue, isLast }: { onContinue: () => void; isLast: boolean }) {
  const [files, setFiles] = useState<RefFile[]>([]);
  const [links, setLinks] = useState<RefLink[]>([]);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState<"file" | "link" | null>(null);
  const [error, setError] = useState("");
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  const hasContent = files.length > 0 || links.length > 0;

  async function handleFileUpload(file: File) {
    setUploading("file");
    setError("");
    const formData = new FormData();
    formData.set("file", file);
    const res = await fetch("/api/extract-text", { method: "POST", body: formData });
    const extracted = await res.json();
    if (!res.ok) {
      setUploading(null);
      setError(extracted.error || "Couldn't read that file.");
      return;
    }
    const result = await saveMemoryFileAction(extracted.fileName, extracted.text);
    setUploading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFiles((prev) => [{ id: result.data.id, name: result.data.name }, ...prev]);
  }

  async function handleAddLink() {
    setUploading("link");
    setError("");
    const result = await saveMemoryLinkAction(linkName, linkUrl);
    setUploading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLinks((prev) => [{ id: result.data.id, name: result.data.name, url: linkUrl }, ...prev]);
    setLinkName("");
    setLinkUrl("");
  }

  async function handleDelete(id: string, kind: "file" | "link") {
    if (kind === "file") setFiles((prev) => prev.filter((f) => f.id !== id));
    else setLinks((prev) => prev.filter((l) => l.id !== id));
    await deleteMemoryAssetAction(id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display italic text-2xl text-coral m-0">Show us what you&apos;ve got</h2>
        <p className="text-slate text-[13px] mt-1.5">
          This is the single biggest thing that makes a quote sound like <em>you</em> instead of a
          generic template. Add your CV or portfolio link, past quotes you&apos;ve sent, case
          studies, or anything that shows your experience and expertise level — the more you add,
          the more specific and credible every quote will be. Add as many as you have.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-paper rounded-lg p-3.5 border border-dashed border-line">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate uppercase tracking-wide mb-2.5">
            <FileText size={12} /> Files
          </div>
          <label className="flex flex-col gap-2 cursor-pointer mb-2.5">
            <input
              type="file"
              accept=".txt,.md,.pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            <span className="flex items-center gap-1.5 font-body font-bold text-[12.5px] text-violet">
              <Upload size={12} />
              {uploading === "file" ? "Reading..." : "Upload a CV, portfolio PDF, past quote..."}
            </span>
          </label>
          <div className="flex flex-col gap-1.5">
            {files.map((f) => (
              <div key={f.id} className="flex justify-between items-center bg-white rounded-lg px-2.5 py-1.5">
                <span className="text-[12px] text-ink truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(f.id, "file")}
                  className="text-text-muted hover:text-overdue flex-shrink-0 bg-none border-none cursor-pointer p-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-paper rounded-lg p-3.5 border border-dashed border-line">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate uppercase tracking-wide mb-2.5">
            <Link2 size={12} /> Links
          </div>
          <div className="flex flex-col gap-1.5 mb-2.5">
            <input
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="Label (e.g. Portfolio, LinkedIn)"
              className="w-full font-body text-xs text-ink bg-white border border-line rounded-lg px-2.5 py-2 outline-none"
            />
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full font-body text-xs text-ink bg-white border border-line rounded-lg px-2.5 py-2 outline-none"
            />
            <button
              type="button"
              onClick={handleAddLink}
              disabled={uploading === "link" || !linkName || !linkUrl}
              className="font-body font-bold text-[12.5px] text-violet text-left disabled:opacity-40 disabled:cursor-default bg-none border-none cursor-pointer p-0"
            >
              {uploading === "link" ? "Saving..." : "+ Add link"}
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {links.map((l) => (
              <div key={l.id} className="flex justify-between items-center bg-white rounded-lg px-2.5 py-1.5">
                <span className="text-[12px] text-violet truncate">{l.name}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(l.id, "link")}
                  className="text-text-muted hover:text-overdue flex-shrink-0 bg-none border-none cursor-pointer p-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="text-overdue text-xs">{error}</div>}

      {showSkipWarning && !hasContent && (
        <div className="flex items-start gap-2 bg-coral-tint rounded-lg px-3.5 py-3 text-[12.5px] text-overdue">
          <TriangleAlert size={15} className="shrink-0 mt-0.5" />
          <span>
            Skipping this means quotes start from a blank slate instead of your actual work —
            they&apos;ll read more generic until you add some of this (you can always add it later
            in Memory).
          </span>
        </div>
      )}

      <div className="flex justify-between items-center">
        {hasContent ? (
          <span className="text-[12.5px] text-success font-semibold">
            {files.length + links.length} added — add more, or continue.
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!showSkipWarning) {
                setShowSkipWarning(true);
                return;
              }
              onContinue();
            }}
            className="font-body font-semibold text-[13px] text-slate bg-none border-none cursor-pointer p-0"
          >
            {showSkipWarning ? "Skip anyway" : "Skip this step"}
          </button>
        )}
        <Button icon={ArrowRight} onClick={onContinue}>
          {isLast ? "Finish setup" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function MemoryStep({
  title,
  subtitle,
  placeholder,
  presets,
  value,
  onChange,
  onContinue,
  isLast,
  pending,
  error,
}: {
  title: string;
  subtitle: string;
  placeholder: string;
  presets: Preset[];
  value: string;
  onChange: (v: string) => void;
  onContinue: () => void;
  isLast: boolean;
  pending: boolean;
  error: string;
}) {
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display italic text-2xl text-coral m-0">{title}</h2>
        <p className="text-slate text-[13px] mt-1.5">{subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Chip key={p.label} active={value === p.text} onClick={() => onChange(p.text)}>
            {p.label}
          </Chip>
        ))}
      </div>

      <TextField value={value} onChange={onChange} placeholder={placeholder} multiline rows={4} />

      {error && <div className="text-overdue text-xs">{error}</div>}

      {showSkipWarning && !value.trim() && (
        <div className="flex items-start gap-2 bg-coral-tint rounded-lg px-3.5 py-3 text-[12.5px] text-overdue">
          <TriangleAlert size={15} className="shrink-0 mt-0.5" />
          <span>
            Skipping this means Freely has less to work with — quotes may be less accurate until
            you fill it in (you can always add it later in Memory).
          </span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={() => {
            if (!value.trim() && !showSkipWarning) {
              setShowSkipWarning(true);
              return;
            }
            onContinue();
          }}
          disabled={pending}
          className="font-body font-semibold text-[13px] text-slate bg-none border-none cursor-pointer p-0"
        >
          {value.trim() ? "Skip" : showSkipWarning ? "Skip anyway" : "Skip this step"}
        </button>
        <Button icon={ArrowRight} spinIcon={pending} disabled={pending} onClick={onContinue}>
          {pending ? "Setting up..." : isLast ? "Finish setup" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
