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
import { ArrowRight, TriangleAlert } from "lucide-react";

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

  const totalSteps = 1 + MEMORY_STEPS.length;
  const onIndustryStep = step === 0;
  const memoryStep = onIndustryStep ? null : MEMORY_STEPS[step - 1];

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
