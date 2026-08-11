"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
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
import {
  saveMemoryFileAction,
  saveMemoryLinkAction,
  deleteMemoryAssetAction,
  analyzeBrandGuideAction,
  analyzeBrandGuideImageAction,
  uploadBrandLogoAction,
} from "@/actions/memory";
import { MAX_DOCUMENT_UPLOAD_BYTES, documentTooLargeError } from "@/lib/upload-limits";
import { extractFileText } from "@/lib/extract-file";
import { hostnameOf, normalizeUrl } from "@/lib/links";
import {
  ArrowRight,
  ChevronLeft,
  TriangleAlert,
  Upload,
  Trash2,
  FileText,
  Link2,
  CheckCircle2,
} from "lucide-react";
import { DropZone } from "@/components/ui/drop-zone";
import { useT } from "@/lib/i18n/context";
import { SubLabel } from "@/components/ui/label";

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
    subtitle: "Tone, structure, level of detail, applied to every quote.",
    placeholder: "e.g. spell out every deliverable explicitly, keep it lean and fast, write for a non-technical client...",
    presets: INSTRUCTIONS_PRESETS,
  },
  {
    id: "toneNotes",
    title: "What voice should it write in?",
    subtitle: "Applied to every quote's language.",
    placeholder: "e.g. warm but efficient, no exclamation points, avoid jargon...",
    presets: TONE_PRESETS,
  },
  {
    id: "storyNotes",
    title: "What's your studio's story?",
    subtitle: "Used to build your AI persona and inform tone.",
    placeholder: "How the studio started, what you're known for, values that should come through in quotes...",
    presets: STORY_PRESETS,
  },
  {
    id: "contextNotes",
    title: "Anything else worth knowing?",
    subtitle: "Rates, engagement length, specialties, anything that shapes pricing.",
    placeholder: "Anything else the AI should know, rates, typical engagement length, industries you specialize in...",
    presets: CONTEXT_PRESETS,
  },
];

export function OnboardingForm() {
  const t = useT();
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState<string | null>(null);
  const [customIndustry, setCustomIndustry] = useState("");
  const [values, setValues] = useState<Record<StepId, string>>({
    industry: "",
    instructions: "",
    toneNotes: "",
    storyNotes: "",
    contextNotes: "",
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // References and Branding state lives up here rather than inside those
  // step components. Both steps save to the database the moment something
  // is added, but the components unmount when you navigate away, so holding
  // this locally meant stepping Back and forward again showed an empty list
  // for material that had in fact been saved. Keeping it at this level makes
  // the whole flow survive navigation in both directions.
  const [refFiles, setRefFiles] = useState<RefFile[]>([]);
  const [refLinks, setRefLinks] = useState<RefLink[]>([]);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [brandGuide, setBrandGuide] = useState<BrandGuideSummary | null>(null);

  const totalSteps = 3 + MEMORY_STEPS.length;
  const onIndustryStep = step === 0;
  const onReferencesStep = step === 1;
  const onBrandingStep = step === 2;
  const memoryStep =
    onIndustryStep || onReferencesStep || onBrandingStep ? null : MEMORY_STEPS[step - 3];
  const industryValue = industry === "other" ? customIndustry.trim() : industry;

  function finish() {
    if (!industryValue) return;
    setError("");
    startTransition(async () => {
      try {
        await completeOnboardingAction({
          industry: industryValue,
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

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
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
          {industry === "other" && (
            <TextField
              value={customIndustry}
              onChange={setCustomIndustry}
              placeholder={t.onboarding.whatWork}
            />
          )}
          {error && <div className="text-overdue text-xs">{error}</div>}
          <Button
            icon={ArrowRight}
            disabled={!industryValue}
            onClick={goNext}
            className="justify-center"
          >
            {t.common.continue}
          </Button>
        </>
      ) : onReferencesStep ? (
        <ReferencesStep
          onBack={goBack}
          onContinue={goNext}
          isLast={step === totalSteps - 1}
          files={refFiles}
          setFiles={setRefFiles}
          links={refLinks}
          setLinks={setRefLinks}
        />
      ) : onBrandingStep ? (
        <BrandingStep
          onBack={goBack}
          onContinue={goNext}
          isLast={step === totalSteps - 1}
          logo={brandLogo}
          setLogo={setBrandLogo}
          guideResult={brandGuide}
          setGuideResult={setBrandGuide}
        />
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
            onBack={goBack}
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
/** What the brand-guide analyzer reports back, held at the form level so the
 * result survives stepping away from the Branding step and back. */
interface BrandGuideSummary {
  primaryColor: string | null;
  accentColor: string | null;
  headingFont: string | null;
  bodyFont: string | null;
}

/** The most load-bearing onboarding step: real material about how this
 * freelancer actually works, not just preferences. A CV, portfolio link,
 * a past quote, a case study — each one gives Claude something concrete to
 * draw on instead of writing generic filler. Reuses the same Memory-asset
 * actions the Memory page's "Files, images & links" section uses, so
 * anything added here shows up there too (and vice versa, later). */
function ReferencesStep({
  onBack,
  onContinue,
  isLast,
  files,
  setFiles,
  links,
  setLinks,
}: {
  onBack: () => void;
  onContinue: () => void;
  isLast: boolean;
  files: RefFile[];
  setFiles: Dispatch<SetStateAction<RefFile[]>>;
  links: RefLink[];
  setLinks: Dispatch<SetStateAction<RefLink[]>>;
}) {
  const t = useT();
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState<"file" | "link" | null>(null);
  const [error, setError] = useState("");
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  const hasContent = files.length > 0 || links.length > 0;

  async function handleFileUpload(file: File) {
    setError("");
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      setError(documentTooLargeError(file));
      return;
    }
    setUploading("file");
    const extracted = await extractFileText(file);
    if (!extracted.ok) {
      setUploading(null);
      setError(extracted.error);
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

  const canAddLink = linkUrl.trim().length > 0 && uploading !== "link";

  async function handleAddLink() {
    if (!canAddLink) return;
    setUploading("link");
    setError("");
    // The label is optional: falling back to the URL's hostname is almost
    // always what someone would have typed anyway, and requiring it was the
    // main reason this form felt fiddly.
    const url = normalizeUrl(linkUrl);
    const result = await saveMemoryLinkAction(linkName.trim() || hostnameOf(url), url);
    setUploading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLinks((prev) => [{ id: result.data.id, name: result.data.name, url }, ...prev]);
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
        <h2 className="font-display italic text-2xl text-coral m-0">{t.onboarding.showUs}</h2>
        <p className="text-slate text-small mt-1.5">
          {t.onboarding.referencesBody}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-paper rounded-lg p-3.5 border border-dashed border-line">
          <SubLabel className="flex items-center gap-1.5 mb-2.5">
            <FileText size={12} /> {t.onboarding.files}
          </SubLabel>
          <DropZone
            onFile={handleFileUpload}
            accept=".txt,.md,.pdf,.docx"
            disabled={uploading === "file"}
            className="flex flex-col gap-2 cursor-pointer mb-2.5 -m-1 p-1"
          >
            <span className="flex items-center gap-1.5 font-body font-bold text-small text-violet">
              <Upload size={12} />
              {uploading === "file" ? "Reading..." : "Drag a file, or click to upload"}
            </span>
          </DropZone>
          <div className="flex flex-col gap-1.5">
            {files.map((f) => (
              <div key={f.id} className="flex justify-between items-center bg-white rounded-lg px-2.5 py-1.5">
                <span className="text-meta text-ink truncate">{f.name}</span>
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
          <SubLabel className="flex items-center gap-1.5 mb-2.5">
            <Link2 size={12} /> {t.onboarding.links}
          </SubLabel>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddLink();
            }}
            className="flex flex-col gap-1.5 mb-2.5"
          >
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={t.onboarding.pasteLink}
              className="w-full font-body text-xs text-ink bg-white border border-line rounded-lg px-2.5 py-2 outline-none"
            />
            <input
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder={t.onboarding.nameItOptional}
              className="w-full font-body text-xs text-ink bg-white border border-line rounded-lg px-2.5 py-2 outline-none"
            />
            <button
              type="submit"
              disabled={!canAddLink}
              className="font-body font-bold text-small text-violet text-left disabled:opacity-40 disabled:cursor-default bg-none border-none cursor-pointer p-0"
            >
              {uploading === "link" ? t.common.saving : t.onboarding.saveLink}
            </button>
          </form>
          <div className="flex flex-col gap-1.5">
            {links.map((l) => (
              <div key={l.id} className="flex justify-between items-center bg-white rounded-lg px-2.5 py-1.5">
                <span className="text-meta text-violet truncate">{l.name}</span>
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
        <div className="flex items-start gap-2 bg-coral-tint rounded-lg px-3.5 py-3 text-small text-overdue">
          <TriangleAlert size={15} className="shrink-0 mt-0.5" />
          <span>
            {t.onboarding.referencesSkipWarning}
          </span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <Button variant="ghost" icon={ChevronLeft} onClick={onBack}>
          {t.common.back}
        </Button>
        <div className="flex items-center gap-4">
          {hasContent ? (
            <span className="text-small text-success font-semibold">
              {files.length + links.length} added, add more, or continue.
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
              className="font-body font-semibold text-small text-slate bg-none border-none cursor-pointer p-0"
            >
              {showSkipWarning ? t.onboarding.skipAnyway : t.onboarding.skipThisStep}
            </button>
          )}
          <Button icon={ArrowRight} onClick={onContinue}>
            {isLast ? t.onboarding.finishSetup : t.common.continue}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Optional — lets a new user upload their brand guide PDF and/or logo right
 * away, instead of only discovering this later in Memory > Branding. Reuses
 * the exact same actions that page uses, so anything set here shows up
 * there too. Colors apply immediately; fonts are shown for reference only
 * (not yet auto-applied to rendered pages). */
function BrandingStep({
  onBack,
  onContinue,
  isLast,
  logo,
  setLogo,
  guideResult,
  setGuideResult,
}: {
  onBack: () => void;
  onContinue: () => void;
  isLast: boolean;
  logo: string | null;
  setLogo: Dispatch<SetStateAction<string | null>>;
  guideResult: BrandGuideSummary | null;
  setGuideResult: Dispatch<SetStateAction<BrandGuideSummary | null>>;
}) {
  const t = useT();
  const [guideUploading, setGuideUploading] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [logoError, setLogoError] = useState("");
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  const hasContent = Boolean(guideResult || logo);

  async function handleGuideUpload(file: File) {
    setGuideError("");
    setGuideResult(null);
    if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
      setGuideError(documentTooLargeError(file));
      return;
    }
    setGuideUploading(true);

    // Images have no extractable text — read them as a data URL and hand
    // them straight to Claude's vision instead of the text-extraction path.
    if (file.type === "image/png" || file.type === "image/jpeg") {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const imageResult = await analyzeBrandGuideImageAction(dataUrl);
      setGuideUploading(false);
      if (!imageResult.ok) {
        setGuideError(imageResult.error);
        return;
      }
      setGuideResult(imageResult.data);
      return;
    }

    const extracted = await extractFileText(file);
    if (!extracted.ok) {
      setGuideUploading(false);
      setGuideError(extracted.error);
      return;
    }
    const result = await analyzeBrandGuideAction(extracted.text);
    setGuideUploading(false);
    if (!result.ok) {
      setGuideError(result.error);
      return;
    }
    setGuideResult(result.data);
  }

  async function handleLogoUpload(file: File) {
    setLogoError("");
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadBrandLogoAction(formData);
    if (!result.ok) {
      setLogoError(result.error);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display italic text-2xl text-coral m-0">{t.onboarding.gotGuidelines}</h2>
        <p className="text-slate text-small mt-1.5">
          {t.onboarding.brandingBody}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-paper rounded-lg p-3.5 border border-dashed border-line">
          <SubLabel className="flex items-center gap-1.5 mb-2.5">
            <FileText size={12} /> {t.onboarding.brandGuidelines}
          </SubLabel>
          <DropZone
            onFile={handleGuideUpload}
            accept=".pdf,.docx,.txt,.md,image/png,image/jpeg"
            disabled={guideUploading}
            className="flex flex-col gap-2 cursor-pointer mb-2.5 -m-1 p-1"
          >
            <span className="flex items-center gap-1.5 font-body font-bold text-small text-violet">
              <Upload size={12} />
              {guideUploading ? "Reading & analyzing..." : "Drag a file, or click to upload"}
            </span>
          </DropZone>
          {guideError && <div className="text-overdue text-xs">{guideError}</div>}
          {guideResult && (
            <div className="flex items-start gap-1.5 bg-mint rounded-lg px-2.5 py-2 text-meta text-ink">
              <CheckCircle2 size={13} className="text-success shrink-0 mt-0.5" />
              <span>
                Found:{" "}
                {[
                  guideResult.primaryColor && `primary ${guideResult.primaryColor}`,
                  guideResult.accentColor && `accent ${guideResult.accentColor}`,
                  guideResult.headingFont && `heading font "${guideResult.headingFont}"`,
                  guideResult.bodyFont && `body font "${guideResult.bodyFont}"`,
                ]
                  .filter(Boolean)
                  .join(", ") || "nothing specific, try a more detailed guide."}
              </span>
            </div>
          )}
        </div>

        <div className="bg-paper rounded-lg p-3.5 border border-dashed border-line">
          <SubLabel className="flex items-center gap-1.5 mb-2.5">
            <Upload size={12} /> {t.onboarding.logo}
          </SubLabel>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={t.onboarding.logo} className="h-9 mb-2" />
          ) : (
            <DropZone
              onFile={handleLogoUpload}
              accept="image/png"
              className="flex flex-col gap-2 cursor-pointer mb-2.5 -m-1 p-1"
            >
              <span className="flex items-center gap-1.5 font-body font-bold text-small text-violet">
                <Upload size={12} />
                {t.onboarding.dragLogo}
              </span>
            </DropZone>
          )}
          <div className="text-caption text-text-muted">
            {t.onboarding.logoRequirements}
          </div>
          {logoError && <div className="text-overdue text-caption mt-1">{logoError}</div>}
        </div>
      </div>

      {showSkipWarning && !hasContent && (
        <div className="flex items-start gap-2 bg-coral-tint rounded-lg px-3.5 py-3 text-small text-overdue">
          <TriangleAlert size={15} className="shrink-0 mt-0.5" />
          <span>
            {t.onboarding.brandingSkipWarning}
          </span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <Button variant="ghost" icon={ChevronLeft} onClick={onBack}>
          {t.common.back}
        </Button>
        <div className="flex items-center gap-4">
          {hasContent ? (
            <span className="text-small text-success font-semibold">{t.onboarding.savedContinue}</span>
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
              className="font-body font-semibold text-small text-slate bg-none border-none cursor-pointer p-0"
            >
              {showSkipWarning ? t.onboarding.skipAnyway : t.onboarding.skipThisStep}
            </button>
          )}
          <Button icon={ArrowRight} onClick={onContinue}>
            {isLast ? t.onboarding.finishSetup : t.common.continue}
          </Button>
        </div>
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
  onBack,
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
  onBack: () => void;
  onContinue: () => void;
  isLast: boolean;
  pending: boolean;
  error: string;
}) {
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const t = useT();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display italic text-2xl text-coral m-0">{title}</h2>
        <p className="text-slate text-small mt-1.5">{subtitle}</p>
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
        <div className="flex items-start gap-2 bg-coral-tint rounded-lg px-3.5 py-3 text-small text-overdue">
          <TriangleAlert size={15} className="shrink-0 mt-0.5" />
          <span>
            {t.onboarding.memorySkipWarning}
          </span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <Button variant="ghost" icon={ChevronLeft} disabled={pending} onClick={onBack}>
          {t.common.back}
        </Button>
        <div className="flex items-center gap-4">
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
            className="font-body font-semibold text-small text-slate bg-none border-none cursor-pointer p-0"
          >
            {value.trim() ? "Skip" : showSkipWarning ? "Skip anyway" : "Skip this step"}
          </button>
          <Button icon={ArrowRight} spinIcon={pending} disabled={pending} onClick={onContinue}>
            {pending ? "Setting up..." : isLast ? "Finish setup" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
