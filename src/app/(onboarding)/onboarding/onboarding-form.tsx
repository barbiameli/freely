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
  CreditCard,
  TriangleAlert,
  Upload,
  Trash2,
  FileText,
  Link2,
  CheckCircle2,
} from "lucide-react";
import { DropZone } from "@/components/ui/drop-zone";
import { startStripeConnectAction } from "@/actions/account";
import type { ConnectState } from "@/lib/stripe-connect";
import { useT } from "@/lib/i18n/context";
import { SubLabel } from "@/components/ui/label";
import { RateBody } from "@/components/quote/setup-rows";
import type { QuoteDraftPayload } from "@/actions/briefs";

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
    subtitle: "Engagement length, specialties, anything else that shapes a quote.",
    placeholder: "Anything else worth knowing, typical engagement length, industries you specialize in...",
    presets: CONTEXT_PRESETS,
  },
];

export function OnboardingForm({ stripeState }: { stripeState: ConnectState }) {
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
  // What they charge and how they get paid. Asked once here so the first quote
  // opens already answered rather than as the form this replaced.
  const [rate, setRate] = useState(0);
  const [rateUnit, setRateUnit] = useState<"HOUR" | "DAY" | "FIXED">("HOUR");
  const [currency, setCurrency] = useState("USD");
  // No country state here any more. RateBody asks for it and researchRateAction
  // saves it, which is also true in Memory and in the quote wizard, so there is
  // one path rather than three.
  const [paymentPlan, setPaymentPlan] = useState<"UPFRONT" | "SPLIT" | "MILESTONE">("SPLIT");
  const [upfrontPercent, setUpfrontPercent] = useState(50);
  const [expertise, setExpertise] = useState<string | null>(null);
  const [refFiles, setRefFiles] = useState<RefFile[]>([]);
  const [refLinks, setRefLinks] = useState<RefLink[]>([]);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [brandGuide, setBrandGuide] = useState<BrandGuideSummary | null>(null);

  // The payments step disappears when Freely itself has no Stripe key: the
  // button would make an account nobody could reach.
  const offerPayments = stripeState !== "unavailable";
  const totalSteps = (offerPayments ? 5 : 4) + MEMORY_STEPS.length;
  const onIndustryStep = step === 0;
  const onPricingStep = step === 1;
  const onReferencesStep = step === 2;
  const onBrandingStep = step === 3;
  const onPaymentsStep = offerPayments && step === 4;
  const memoryStep =
    onIndustryStep || onPricingStep || onReferencesStep || onBrandingStep || onPaymentsStep
      ? null
      : MEMORY_STEPS[step - (offerPayments ? 5 : 4)];
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
          rate,
          rateUnit,
          currency,
          paymentPlan,
          upfrontPercent,
          // Only sent when they chose one, which only happens on the branch
          // where they said they do not know their rate.
          ...(expertise ? { expertiseLevel: expertise } : {}),
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
      ) : onPricingStep ? (
        <PricingStep
          onBack={goBack}
          onContinue={goNext}
          rate={rate}
          setRate={setRate}
          rateUnit={rateUnit}
          setRateUnit={setRateUnit}
          currency={currency}
          setCurrency={setCurrency}
          paymentPlan={paymentPlan}
          setPaymentPlan={setPaymentPlan}
          upfrontPercent={upfrontPercent}
          setUpfrontPercent={setUpfrontPercent}
          expertise={expertise}
          setExpertise={setExpertise}
        />
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
      ) : onPaymentsStep ? (
        <PaymentsStep
          onBack={goBack}
          onContinue={goNext}
          isLast={step === totalSteps - 1}
          state={stripeState}
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

/**
 * What you charge, and how you usually get paid.
 *
 * Here rather than on every quote. Both answers are properties of the
 * freelancer, and the wizard reads them as its usual setup, so a second quote
 * is four readable lines instead of fourteen fields.
 *
 * Skippable, and the skip is the interesting branch: somebody who does not know
 * their rate is asked their seniority instead, which is the one thing that lets
 * a rate be researched. Asked here it is a question with a purpose; asked on
 * every quote alongside a rate, as it used to be, it changed nothing.
 */
function PricingStep({
  onBack,
  onContinue,
  rate,
  setRate,
  rateUnit,
  setRateUnit,
  currency,
  setCurrency,
  paymentPlan,
  setPaymentPlan,
  upfrontPercent,
  setUpfrontPercent,
  expertise,
  setExpertise,
}: {
  onBack: () => void;
  onContinue: () => void;
  rate: number;
  setRate: (n: number) => void;
  rateUnit: "HOUR" | "DAY" | "FIXED";
  setRateUnit: (u: "HOUR" | "DAY" | "FIXED") => void;
  currency: string;
  setCurrency: (c: string) => void;
  paymentPlan: "UPFRONT" | "SPLIT" | "MILESTONE";
  setPaymentPlan: (p: "UPFRONT" | "SPLIT" | "MILESTONE") => void;
  upfrontPercent: number;
  setUpfrontPercent: (n: number) => void;
  expertise: string | null;
  setExpertise: (level: string | null) => void;
}) {
  const t = useT();
  const [unsure, setUnsure] = useState(false);

  // RateBody speaks draft, this step speaks separate values. Rather than give
  // the step a second way to hold the same four things, the draft is assembled
  // here and taken apart again on the way back.
  const rateDraft = {
    sourceText: "",
    instructions: "",
    memoryProjectTitles: [],
    hourlyRate: rate,
    rateUnit,
    currency,
    expertiseLevel: expertise ?? undefined,
  } as unknown as QuoteDraftPayload;

  function setRateDraft(update: SetStateAction<QuoteDraftPayload>) {
    const next = typeof update === "function" ? update(rateDraft) : update;
    if (next.hourlyRate !== rate) setRate(next.hourlyRate ?? 0);
    if (next.rateUnit && next.rateUnit !== rateUnit) setRateUnit(next.rateUnit);
    if (next.currency && next.currency !== currency) setCurrency(next.currency);
    if (next.expertiseLevel !== expertise) setExpertise(next.expertiseLevel ?? null);
  }

  return (
    <>
      {/* The same heading every other onboarding step uses. This one was body
          bold where the rest are display italic, which made the pricing step
          read as a subsection of the step before it. */}
      <div>
        <h2 className="font-display italic text-2xl text-coral m-0">{t.onboarding.pricingTitle}</h2>
        <p className="text-slate text-small mt-1.5 mb-0">{t.onboarding.pricingSubtitle}</p>
      </div>

      {/* The wizard's own rate control, rather than a second copy of it.
          This step used to be hand-rolled: it asked for a level and a country
          and then did nothing with them, so somebody who said they did not
          know what to charge answered two questions and left with no rate.
          Meanwhile Memory and the quote wizard both had a working Find my
          rate. Rendering the same component in all three places is what makes
          "it works the same everywhere" true rather than aspirational. */}
      <RateBody
        draft={rateDraft}
        setDraft={setRateDraft}
        rateHelpOpen={unsure}
        setRateHelpOpen={(next) => {
          setUnsure(next);
          if (next) setRate(0);
          else setExpertise(null);
        }}
      />
      <div>
        <SubLabel>{t.quote.paymentWhen}</SubLabel>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["UPFRONT", t.quote.paymentUpfront],
              ["SPLIT", t.quote.paymentSplit],
              ["MILESTONE", t.quote.paymentMilestone],
            ] as const
          ).map(([value, label]) => (
            <Chip key={value} active={paymentPlan === value} onClick={() => setPaymentPlan(value)}>
              {label}
            </Chip>
          ))}
        </div>
        {paymentPlan === "SPLIT" && (
          <div className="mt-3">
            <SubLabel>{t.quote.paymentHowMuchUpfront}</SubLabel>
            <div className="flex flex-wrap gap-1.5">
              {[25, 40, 50].map((pct) => (
                <Chip
                  key={pct}
                  active={upfrontPercent === pct}
                  onClick={() => setUpfrontPercent(pct)}
                >
                  {`${pct}%`}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-caption text-text-muted m-0">{t.onboarding.pricingChangeable}</p>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" icon={ChevronLeft} onClick={onBack}>
          {t.common.back}
        </Button>
        {/* A level is load-bearing on this branch: without it a rate gets
            researched for nobody in particular. The country is asked inside
            RateBody and saved when the research runs, so it is not gated here
            as well. On the other branch nothing is required, because a rate
            they gave answers the same question. */}
        <Button
          icon={ArrowRight}
          disabled={unsure && !expertise}
          onClick={onContinue}
        >
          {t.common.continue}
        </Button>
      </div>
    </>
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
      setError(documentTooLargeError(file, "several"));
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
                  className="text-text-muted hover:text-overdue flex-shrink-0 bg-none border-none cursor-pointer p-0 tap"
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
              className="font-body font-bold text-small text-violet text-left disabled:opacity-40 disabled:cursor-default bg-none border-none cursor-pointer p-0 tap"
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
                  className="text-text-muted hover:text-overdue flex-shrink-0 bg-none border-none cursor-pointer p-0 tap"
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
              className="font-body font-semibold text-small text-slate bg-none border-none cursor-pointer p-0 tap"
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
              className="font-body font-semibold text-small text-slate bg-none border-none cursor-pointer p-0 tap"
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

/**
 * Offering card payments, once, and making the skip the easy answer.
 *
 * Here because somebody setting up their account is already in the mood to
 * answer questions about how they work, and because discovering months later
 * that invoices could have taken card payments is a worse outcome than being
 * asked once.
 *
 * Written to be skippable without a hint of a penalty. Linking Stripe means
 * handing identity documents to a third party, which is a reasonable thing to
 * want to think about, and the invoice PDF works either way. The three lines
 * under the description exist so the decision is made on facts rather than on
 * a fear of missing out: it costs a cut, it is not required, and it can be
 * done later.
 *
 * If the platform has no Stripe key at all this step never renders, because
 * the button would create an account that cannot be reached.
 */
function PaymentsStep({
  onBack,
  onContinue,
  isLast,
  state,
}: {
  onBack: () => void;
  onContinue: () => void;
  isLast: boolean;
  state: ConnectState;
}) {
  const t = useT();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function connect() {
    setWorking(true);
    setError("");
    const result = await startStripeConnectAction();
    if (!result.ok) {
      setError(result.error);
      setWorking(false);
      return;
    }
    window.location.href = result.data.url;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display italic text-2xl text-coral m-0">{t.onboarding.paymentsTitle}</h2>
        <p className="text-slate text-small mt-1.5 text-pretty">{t.onboarding.paymentsBody}</p>
      </div>

      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        {[t.onboarding.paymentsPoint1, t.onboarding.paymentsPoint2, t.onboarding.paymentsPoint3].map(
          (line) => (
            <li key={line} className="flex items-start gap-2 text-small text-slate">
              <span className="w-1 h-1 rounded-full bg-text-muted shrink-0 mt-2.5" />
              <span className="text-pretty">{line}</span>
            </li>
          )
        )}
      </ul>

      {state === "ready" && (
        <div className="flex items-start gap-1.5 bg-mint rounded-lg px-3 py-2.5 text-small text-ink">
          <CheckCircle2 size={14} className="text-success shrink-0 mt-0.5" />
          <span>{t.onboarding.paymentsConnected}</span>
        </div>
      )}
      {state === "pending" && (
        <div className="text-small text-slate bg-paper border border-line rounded-lg px-3 py-2.5">
          {t.onboarding.paymentsPending}
        </div>
      )}
      {error && <div className="text-overdue text-small">{error}</div>}

      <div className="flex justify-between items-center">
        <Button variant="ghost" icon={ChevronLeft} onClick={onBack}>
          {t.common.back}
        </Button>
        <div className="flex items-center gap-4">
          {state !== "ready" && (
            <button
              type="button"
              onClick={onContinue}
              className="font-body font-semibold text-small text-slate bg-none border-none cursor-pointer p-0 tap"
            >
              {t.onboarding.paymentsSkip}
            </button>
          )}
          {state === "ready" ? (
            <Button icon={ArrowRight} onClick={onContinue}>
              {isLast ? t.onboarding.finishSetup : t.common.continue}
            </Button>
          ) : (
            <Button icon={CreditCard} disabled={working} onClick={connect}>
              {t.onboarding.paymentsConnect}
            </Button>
          )}
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
            className="font-body font-semibold text-small text-slate bg-none border-none cursor-pointer p-0 tap"
          >
            {value.trim() ? "Skip" : showSkipWarning ? "Skip anyway" : "Skip this step"}
          </button>
          <Button icon={ArrowRight} spinIcon={pending} loading={pending} onClick={onContinue}>
            {pending ? "Setting up..." : isLast ? "Finish setup" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
