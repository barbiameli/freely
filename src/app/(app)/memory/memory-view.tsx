"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Trash2, PenTool, Link2, Sparkles, Pencil, Upload, FileText, CheckCircle2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { DropZone } from "@/components/ui/drop-zone";
import {
  updateMemoryInstructionsAction,
  updateMemoryNotesAction,
  saveMemoryFileAction,
  uploadMemoryImageAction,
  saveMemoryLinkAction,
  generatePersonaAction,
  updatePersonaAction,
  updateBrandingAction,
  uploadBrandLogoAction,
  analyzeBrandGuideAction,
  analyzeBrandGuideImageAction,
  deleteMemoryAssetAction,
} from "@/actions/memory";
import { disconnectProviderAction, type Provider } from "@/actions/connections";
import { industryLabel } from "@/lib/industries";
import { MAX_DOCUMENT_UPLOAD_BYTES, documentTooLargeError } from "@/lib/upload-limits";
import { extractFileText } from "@/lib/extract-file";
import { CURRENCIES } from "@/lib/currencies";
import { hostnameOf, normalizeUrl } from "@/lib/links";
import {
  type Preset,
  TONE_PRESETS,
  INSTRUCTIONS_PRESETS,
  STORY_PRESETS,
  CONTEXT_PRESETS,
} from "@/lib/memory-presets";

/**
 * Memory used to be seven separate tabs. It's now one scrollable, modular
 * page — everything the AI draws on (persona, voice, story, context, files,
 * images, links, branding, connectors) lives together, closer to how a
 * memory/context page works elsewhere. The chip row below is just an anchor
 * nav for quick jumping, not a tab switcher — nothing is hidden.
 */
const SECTIONS = [
  ["persona", "Persona"],
  ["voice", "Voice"],
  ["story", "Story & context"],
  ["references", "Files, images & links"],
  ["branding", "Branding"],
  ["connectors", "Connectors"],
] as const;

interface FileAsset {
  id: string;
  name: string;
  createdAt: string;
}
interface ImageAsset {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}
interface LinkAsset {
  id: string;
  name: string;
  url: string;
  createdAt: string;
}
interface ConnectionInfo {
  provider: Provider;
  accountLabel: string | null;
  connectedAt: string;
}
export function MemoryView({
  industry,
  aiPersona,
  personaUpdatedAt,
  initialInstructions,
  initialTone,
  initialStory,
  initialContext,
  brandPrimaryColor,
  brandAccentColor,
  brandLogoDataUrl,
  brandHeadingFont,
  brandBodyFont,
  currency,
  files,
  images,
  links,
  connections,
}: {
  industry: string | null;
  aiPersona: string | null;
  personaUpdatedAt: string | null;
  initialInstructions: string;
  initialTone: string;
  initialStory: string;
  initialContext: string;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  brandLogoDataUrl: string | null;
  brandHeadingFont: string | null;
  brandBodyFont: string | null;
  currency: string;
  files: FileAsset[];
  images: ImageAsset[];
  links: LinkAsset[];
  connections: ConnectionInfo[];
}) {
  return (
    <>
      <Topbar eyebrow="Memory" />
      <div>
        <h1 className="font-display italic text-[32px] text-coral m-0">
          What it knows about your studio.
        </h1>
        <p className="text-slate text-[13px] mt-2">
          This context shapes quote generation. Working as: <span className="font-semibold text-slate">{industryLabel(industry)}</span>.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            <Chip>{label}</Chip>
          </a>
        ))}
      </div>

      <div className="flex flex-col gap-7">
        <section id="persona" className="scroll-mt-6">
          <PersonaCard initial={aiPersona} updatedAt={personaUpdatedAt} />
        </section>

        <section id="voice" className="scroll-mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <AutosaveNotes
            field={null}
            initial={initialInstructions}
            isInstructions
            label="Instructions"
            presets={INSTRUCTIONS_PRESETS}
            rows={4}
          />
          <AutosaveNotes
            field="toneNotes"
            initial={initialTone}
            label="Tone notes"
            placeholder="e.g. warm but efficient, no exclamation points, avoid jargon..."
            presets={TONE_PRESETS}
            rows={4}
          />
        </section>

        <section id="story" className="scroll-mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <AutosaveNotes
            field="storyNotes"
            initial={initialStory}
            label="Studio story"
            placeholder="How the studio started, what you're known for, values that should come through in quotes..."
            presets={STORY_PRESETS}
            rows={4}
          />
          <AutosaveNotes
            field="contextNotes"
            initial={initialContext}
            label="Additional context"
            placeholder="Anything else the AI should know, rates, typical engagement length, industries you specialize in..."
            presets={CONTEXT_PRESETS}
            rows={4}
          />
        </section>

        <section id="references" className="scroll-mt-6">
          <ReferencesCard files={files} images={images} links={links} />
        </section>

        <section id="branding" className="scroll-mt-6">
          <BrandingCard
            primaryColor={brandPrimaryColor}
            accentColor={brandAccentColor}
            logoDataUrl={brandLogoDataUrl}
            headingFont={brandHeadingFont}
            bodyFont={brandBodyFont}
            currency={currency}
          />
        </section>

        <section id="connectors" className="scroll-mt-6">
          <ConnectorsCard connections={connections} />
        </section>
      </div>
    </>
  );
}

function PersonaCard({ initial, updatedAt }: { initial: string | null; updatedAt: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function regenerate() {
    setError("");
    startTransition(async () => {
      const result = await generatePersonaAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setValue(result.data.persona);
      setEditing(false);
    });
  }

  function saveEdit() {
    startTransition(async () => {
      await updatePersonaAction(value);
      setEditing(false);
    });
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-2.5">
        <Label>Persona</Label>
        <span className="text-xs text-text-muted">
          {updatedAt ? `Updated ${new Date(updatedAt).toLocaleDateString()}` : "Not generated yet"}
        </span>
      </div>
      <p className="text-[11px] text-text-muted mb-3">
        Built from your Story, Tone, Context, saved files, and past projects. Correct it any time.
      </p>
      {editing ? (
        <TextField value={value} onChange={setValue} multiline rows={4} />
      ) : (
        <p className="text-sm leading-relaxed text-ink m-0 min-h-[3em]">
          {value || "Nothing generated yet, add a bit to Story or Files below, then generate."}
        </p>
      )}
      {error && <div className="text-overdue text-xs mt-2">{error}</div>}
      <div className="flex gap-2.5 mt-3">
        <Button icon={Sparkles} spinIcon={pending} disabled={pending} onClick={regenerate}>
          {value ? "Regenerate" : "Generate persona"}
        </Button>
        {editing ? (
          <Button variant="outline" disabled={pending} onClick={saveEdit}>
            Save edit
          </Button>
        ) : (
          <Button variant="ghost" icon={Pencil} disabled={pending} onClick={() => setEditing(true)}>
            Correct it
          </Button>
        )}
      </div>
    </Card>
  );
}

function AutosaveNotes({
  field,
  initial,
  label = "Core instructions",
  placeholder,
  isInstructions,
  presets,
  rows = 5,
}: {
  field: "toneNotes" | "storyNotes" | "contextNotes" | null;
  initial: string;
  label?: string;
  placeholder?: string;
  isInstructions?: boolean;
  presets?: Preset[];
  rows?: number;
}) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (value === initial) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (isInstructions) {
        await updateMemoryInstructionsAction(value);
      } else if (field) {
        await updateMemoryNotesAction(field, value);
      }
      setStatus("saved");
    }, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Card>
      <div className="flex justify-between items-center mb-2.5">
        <Label>{label}</Label>
        <span className="text-xs text-success font-body font-semibold">
          {status === "saving" ? "saving..." : status === "saved" ? "saved" : "saved automatically"}
        </span>
      </div>
      {presets && presets.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] text-text-muted mb-1.5">
            Start from a preset, one click sets the text below, then edit as you like.
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Chip key={p.label} active={value === p.text} onClick={() => setValue(p.text)}>
                {p.label}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <TextField value={value} onChange={setValue} multiline rows={rows} placeholder={placeholder} />
    </Card>
  );
}

function ReferencesCard({
  files,
  images,
  links,
}: {
  files: FileAsset[];
  images: ImageAsset[];
  links: LinkAsset[];
}) {
  const [fileItems, setFileItems] = useState(files);
  const [imageItems, setImageItems] = useState(images);
  const [linkItems, setLinkItems] = useState(links);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState<"file" | "image" | "link" | null>(null);
  const [error, setError] = useState("");

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
    setFileItems((prev) => [
      { id: result.data.id, name: result.data.name, createdAt: new Date().toISOString() },
      ...prev,
    ]);
  }

  async function handleImageUpload(file: File) {
    setUploading("image");
    setError("");
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadMemoryImageAction(formData);
    setUploading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageItems((prev) => [
        {
          id: result.data.id,
          name: result.data.name,
          dataUrl: String(reader.result),
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    };
    reader.readAsDataURL(file);
  }

  const canAddLink = linkUrl.trim().length > 0 && uploading !== "link";

  async function handleAddLink() {
    if (!canAddLink) return;
    setUploading("link");
    setError("");
    // Naming a link is optional: the hostname is almost always what someone
    // would have typed, and requiring it made this form needlessly fiddly.
    const url = normalizeUrl(linkUrl);
    const result = await saveMemoryLinkAction(linkName.trim() || hostnameOf(url), url);
    setUploading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLinkItems((prev) => [
      { id: result.data.id, name: result.data.name, url, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setLinkName("");
    setLinkUrl("");
  }

  async function handleDelete(id: string, kind: "file" | "image" | "link") {
    if (kind === "file") setFileItems((prev) => prev.filter((f) => f.id !== id));
    if (kind === "image") setImageItems((prev) => prev.filter((f) => f.id !== id));
    if (kind === "link") setLinkItems((prev) => prev.filter((f) => f.id !== id));
    await deleteMemoryAssetAction(id);
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-1">
        <Label>Files, images & links</Label>
        <span className="text-xs text-text-muted">
          Files &amp; links feed the AI directly; images are for your own brand reference.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-3">
        <div>
          <div className="text-[11px] font-semibold text-slate mb-2 uppercase tracking-wide">Files</div>
          <DropZone
            onFile={handleFileUpload}
            accept=".txt,.md,.pdf,.docx"
            disabled={uploading === "file"}
            className="flex flex-col gap-2 cursor-pointer mb-3 -m-1 p-1"
          >
            <span className="font-body font-bold text-[12.5px] text-violet">
              {uploading === "file" ? "Reading..." : "+ Upload or drag a file"}
            </span>
          </DropZone>
          <div className="flex flex-col gap-2">
            {fileItems.map((f) => (
              <div key={f.id} className="flex justify-between items-center bg-paper rounded-lg px-3 py-2">
                <span className="text-[12.5px] text-ink truncate">{f.name}</span>
                <button onClick={() => handleDelete(f.id, "file")} className="text-text-muted hover:text-overdue flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {fileItems.length === 0 && <div className="text-text-muted text-xs">None yet.</div>}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate mb-2 uppercase tracking-wide">Images</div>
          <DropZone
            onFile={handleImageUpload}
            accept="image/*"
            disabled={uploading === "image"}
            className="flex flex-col gap-2 cursor-pointer mb-3 -m-1 p-1"
          >
            <span className="font-body font-bold text-[12.5px] text-violet">
              {uploading === "image" ? "Uploading..." : "+ Upload or drag an image"}
            </span>
          </DropZone>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {imageItems.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <div key={img.id} className="relative group">
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="w-full aspect-square object-cover rounded-lg border border-line"
                />
                <button
                  onClick={() => handleDelete(img.id, "image")}
                  className="absolute top-1 right-1 bg-white rounded-full p-1 border border-line"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
          {imageItems.length === 0 && <div className="text-text-muted text-xs">None yet.</div>}
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate mb-2 uppercase tracking-wide">Links</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddLink();
            }}
            className="flex flex-col gap-1.5 mb-3"
          >
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Paste a link, then press enter"
              className="w-full font-body text-xs text-ink bg-paper border border-line rounded-lg px-2.5 py-2 outline-none"
            />
            <input
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="Name it (optional)"
              className="w-full font-body text-xs text-ink bg-paper border border-line rounded-lg px-2.5 py-2 outline-none"
            />
            <button
              type="submit"
              disabled={!canAddLink}
              className="font-body font-bold text-[12.5px] text-violet text-left disabled:opacity-40 disabled:cursor-default"
            >
              {uploading === "link" ? "Saving..." : "Save link"}
            </button>
          </form>
          <div className="flex flex-col gap-2">
            {linkItems.map((l) => (
              <div key={l.id} className="flex justify-between items-center bg-paper rounded-lg px-3 py-2">
                <a href={l.url} target="_blank" rel="noreferrer" className="text-[12.5px] text-violet truncate">
                  {l.name}
                </a>
                <button onClick={() => handleDelete(l.id, "link")} className="text-text-muted hover:text-overdue flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {linkItems.length === 0 && <div className="text-text-muted text-xs">None yet.</div>}
          </div>
        </div>
      </div>
      {error && <div className="text-overdue text-xs mt-3">{error}</div>}
    </Card>
  );
}

function BrandingCard({
  primaryColor,
  accentColor,
  logoDataUrl,
  headingFont,
  bodyFont,
  currency,
}: {
  primaryColor: string | null;
  accentColor: string | null;
  logoDataUrl: string | null;
  headingFont: string | null;
  bodyFont: string | null;
  currency: string;
}) {
  const [primary, setPrimary] = useState(primaryColor ?? "#F45B69");
  const [accent, setAccent] = useState(accentColor ?? "#6320EE");
  const [logo, setLogo] = useState(logoDataUrl);
  const [logoError, setLogoError] = useState("");
  const [curr, setCurr] = useState(currency);
  const [pending, startTransition] = useTransition();

  const [heading, setHeading] = useState(headingFont);
  const [body, setBody] = useState(bodyFont);
  const [guideUploading, setGuideUploading] = useState(false);
  const [guideError, setGuideError] = useState("");
  const [guideResult, setGuideResult] = useState<{
    primaryColor: string | null;
    accentColor: string | null;
    headingFont: string | null;
    bodyFont: string | null;
    notes: string | null;
  } | null>(null);

  function save(patch: { brandPrimaryColor?: string; brandAccentColor?: string; currency?: string }) {
    startTransition(() => {
      updateBrandingAction(patch);
    });
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
    if (result.data.suggestedColor) setPrimary(result.data.suggestedColor);
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

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
      const result = await analyzeBrandGuideImageAction(dataUrl);
      setGuideUploading(false);
      if (!result.ok) {
        setGuideError(result.error);
        return;
      }
      setGuideResult(result.data);
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
    if (result.data.primaryColor) setPrimary(result.data.primaryColor);
    if (result.data.accentColor) setAccent(result.data.accentColor);
    if (result.data.headingFont) setHeading(result.data.headingFont);
    if (result.data.bodyFont) setBody(result.data.bodyFont);
  }

  return (
    <Card>
      <Label>Branding</Label>
      <p className="text-[11px] text-text-muted mb-3">
        Applied to your public client site, public quote pages, and PDF exports, so clients see
        your studio&apos;s look, not Freely&apos;s default.
      </p>

      <div className="bg-paper rounded-lg p-3.5 mb-4">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate mb-1.5 uppercase tracking-wide">
          <FileText size={12} /> Brand guidelines
        </div>
        <p className="text-[11.5px] text-text-muted mb-2">
          The AI pulls out colors and typeface names. Colors apply immediately; fonts are shown for reference.
        </p>
        <DropZone
          onFile={handleGuideUpload}
          accept=".pdf,.docx,.txt,.md,image/png,image/jpeg"
          disabled={guideUploading}
          className="flex items-center gap-1.5 cursor-pointer mb-1 -m-1 p-1"
        >
          <Upload size={12} className="text-violet" />
          <span className="font-body font-bold text-[12.5px] text-violet">
            {guideUploading ? "Reading & analyzing..." : "Upload or drag brand guidelines"}
          </span>
        </DropZone>
        {guideError && <div className="text-overdue text-xs mt-1.5">{guideError}</div>}
        {guideResult && (
          <div className="flex items-start gap-1.5 bg-mint rounded-lg px-3 py-2.5 mt-2 text-[12px] text-ink">
            <CheckCircle2 size={13} className="text-success shrink-0 mt-0.5" />
            <div>
              Found: {[
                guideResult.primaryColor && `primary ${guideResult.primaryColor}`,
                guideResult.accentColor && `accent ${guideResult.accentColor}`,
                guideResult.headingFont && `heading font "${guideResult.headingFont}"`,
                guideResult.bodyFont && `body font "${guideResult.bodyFont}"`,
              ]
                .filter(Boolean)
                .join(", ") || "nothing specific, try a more detailed guide."}
              {guideResult.notes && <div className="text-text-muted mt-1">{guideResult.notes}</div>}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
        <div>
          <div className="text-[11px] font-semibold text-slate mb-2 uppercase tracking-wide">Logo</div>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Logo" className="h-10 mb-2" />
          ) : (
            <div className="text-xs text-text-muted mb-2">Using the Freely wordmark for now.</div>
          )}
          <DropZone
            onFile={handleLogoUpload}
            accept="image/png"
            className="flex items-center gap-1.5 cursor-pointer -m-1 p-1"
          >
            <Upload size={12} className="text-violet" />
            <span className="font-body font-bold text-[12.5px] text-violet">Upload or drag logo</span>
          </DropZone>
          <div className="text-[10.5px] text-text-muted mt-1 max-w-[160px]">
            PNG with a transparent background, at least 200×200px.
          </div>
          {logoError && <div className="text-overdue text-[11px] mt-1 max-w-[180px]">{logoError}</div>}
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="text-[11px] font-semibold text-slate mb-2 uppercase tracking-wide">Primary color</div>
            <input
              type="color"
              value={primary}
              onChange={(e) => {
                setPrimary(e.target.value);
                save({ brandPrimaryColor: e.target.value });
              }}
              className="w-12 h-9 rounded border border-line cursor-pointer"
            />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate mb-2 uppercase tracking-wide">Accent color</div>
            <input
              type="color"
              value={accent}
              onChange={(e) => {
                setAccent(e.target.value);
                save({ brandAccentColor: e.target.value });
              }}
              className="w-12 h-9 rounded border border-line cursor-pointer"
            />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate mb-2 uppercase tracking-wide">Currency</div>
            <select
              value={curr}
              onChange={(e) => {
                setCurr(e.target.value);
                save({ currency: e.target.value });
              }}
              className="h-9 rounded border border-line bg-paper px-2.5 text-sm text-ink cursor-pointer"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {(heading || body) && (
        <div className="flex gap-6 mt-4 pt-4 border-t border-line">
          {heading && (
            <div>
              <div className="text-[11px] font-semibold text-slate mb-1 uppercase tracking-wide">
                Heading font
              </div>
              <div className="text-sm text-ink">{heading}</div>
            </div>
          )}
          {body && (
            <div>
              <div className="text-[11px] font-semibold text-slate mb-1 uppercase tracking-wide">
                Body font
              </div>
              <div className="text-sm text-ink">{body}</div>
            </div>
          )}
        </div>
      )}
      <p className="text-[11px] text-text-muted mt-2.5">
        Default currency for new quotes, each quote can still be changed individually in the
        wizard.
      </p>
      {pending && <div className="text-xs text-text-muted mt-2">Saving...</div>}
    </Card>
  );
}

const PROVIDER_LABEL: Record<Provider, string> = {
  FIGMA: "Figma",
  NOTION: "Notion",
  GITHUB: "GitHub",
};

function ConnectorsCard({ connections }: { connections: ConnectionInfo[] }) {
  const connected = new Map(connections.map((c) => [c.provider, c]));

  return (
    <Card>
      <Label>Connectors</Label>
      <div className="flex flex-col gap-3 mt-2">
        <ConnectorRow provider="FIGMA" icon={<PenTool size={16} />} info={connected.get("FIGMA")} />
        <ConnectorRow provider="NOTION" icon={<Link2 size={16} />} info={connected.get("NOTION")} />
        <ConnectorRow provider="GITHUB" icon={<Link2 size={16} />} info={connected.get("GITHUB")} />
      </div>
    </Card>
  );
}

function ConnectorRow({
  provider,
  icon,
  info,
}: {
  provider: Provider;
  icon: React.ReactNode;
  info?: ConnectionInfo;
}) {
  const [working, setWorking] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-paper rounded-lg px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white border border-line flex items-center justify-center text-slate">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-body font-semibold text-sm text-ink">{PROVIDER_LABEL[provider]}</span>
            {!info && (
              <span className="font-body font-semibold text-[10px] uppercase tracking-wide text-text-muted bg-white border border-line rounded-full px-2 py-0.5">
                Coming soon
              </span>
            )}
          </div>
          <div className="text-xs text-text-muted">
            {info ? `Connected${info.accountLabel ? ` as ${info.accountLabel}` : ""}` : "Not connected"}
          </div>
        </div>
      </div>
      {info ? (
        <Button
          variant="ghost"
          disabled={working}
          onClick={async () => {
            setWorking(true);
            await disconnectProviderAction(provider);
            setWorking(false);
            window.location.reload();
          }}
        >
          Disconnect
        </Button>
      ) : (
        <Button variant="ghost" disabled>
          Coming soon
        </Button>
      )}
    </div>
  );
}
