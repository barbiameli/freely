"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Check,
  Link2,
  CheckCircle2,
  Trash2,
  ChevronDown,
  FileText,
  Copy,
  ExternalLink,
  Eye,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import {
  refineBriefAction,
  addBriefToTrackAction,
  setBriefPublishedAction,
  updateBriefContentAction,
  updateQuoteLookAction,
  generateExtrasAction,
  setQuoteDisciplineAction,
  toggleSectionAction,
  deleteBriefExampleAction,
} from "@/actions/briefs";
import { currencySymbol } from "@/lib/currencies";
import { repriceForHours, effectiveRate } from "@/lib/repricing";
import { paragraphs } from "@/lib/rich-text";
import { useAction } from "@/lib/use-action";
import { ActionError } from "@/components/ui/action-error";
import { DownloadPdfButton } from "@/components/download-pdf-button";
import {
  rateSuffix,
  describeEffort,
  parseRateUnit,
  effortLabel,
  rateLabel,
  effortShort,
} from "@/lib/rate-unit";
import { DeliverableList } from "@/components/deliverable-list";
import { TimelineView } from "@/components/timeline-view";
import { timelineTotal } from "@/lib/timeline";
import type { BriefExtras } from "@/lib/anthropic";
import { EditableBlock, EditableSection } from "@/components/editable-text";
import { Chip } from "@/components/ui/chip";
import { SubLabel } from "@/components/ui/label";
import { RenderedQuote } from "@/components/quote/rendered-quote";
import { QuotePreview } from "@/components/quote/quote-preview";
import { BeforeYouSend } from "@/components/quote/before-you-send";
import { brokenRules, type RuleSettings } from "@/lib/ground-rules";
import { applyHiddenSections, type HideableSection } from "@/lib/hidden-sections";
import { hasStrategyContent } from "@/lib/strategy";
import type { BrandSource } from "@/lib/branding";
import type { PublicBrief } from "@/app/q/[slug]/templates";
import { useT } from "@/lib/i18n/context";

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
  extras?: BriefExtras | null;
  strategy?: Strategy | null;
  currency?: string | null;
  price: number;
  hours: number;
  hourlyRate?: number | null;
  rateUnit?: string | null;
  status: string;
  createdAt: string;
  published: boolean;
  publicSlug: string;
  template?: string;
  /** Everything the preview needs to draw the real client-facing page. */
  branding?: string;
  language?: string;
  /** Whether the client can sign it, which the templates show. */
  signable?: boolean;
  /** Open questions already ticked off, by their text. */
  clearedQuestions?: string[];
  /** Which layout this quote was written for. See lib/quote-layout. */
  layout?: number;
  /** Whether the total is the price or an estimate. See lib/quote-definitions. */
  billing?: string | null;
  /** Ground rules already waved through on this quote. */
  rulesAcknowledged?: string[];
  /** The payment plan, so a rule made moot by it stays quiet. */
  paymentPlan?: string | null;
  /** How much armour it was written with. See lib/protection. */
  protection?: string | null;
  /** Whether the stages are payment points. See lib/quote-layout. */
  milestonesBillable?: boolean;
  /** Changes with every save, so the editor knows to take the server's copy. */
  updatedAt?: string;
  /** The add-on sections are still being written. See generateExtrasAction. */
  extrasPending?: boolean;
  /** Which kind of work the model decided this is, when the account does more
   * than one. */
  discipline?: string | null;
  hiddenSections?: string[];
  /**
   * How the work splits into billable chunks, when the quote is billed that
   * way. Shown so it can be checked before the quote goes out: the split is
   * part of what the client agrees to, and changing it afterwards means
   * changing the agreement.
   */
  milestones?: {
    name: string;
    deliverableIndexes: number[];
    /** The agreement that closes it, which is why the split falls here. */
    gate?: string;
    amount: number;
  }[];
  sourceText?: string | null;
  accepted?: { name: string; email: string; at: string } | null;
  examples: Example[];
}

/**
 * A section card with an eyebrow label, a tinted background, and a colored
 * left rule — the "give every section a distinct block" treatment, so the
 * page reads as separated cards instead of one flat scroll of text.
 *
 * Sections that can be taken out carry a Remove, and when removed they stay
 * on the page as a single line offering to put them back. The written content
 * is never deleted, so the offer costs nothing and always works.
 */
function Section({
  id,
  eyebrow,
  tint,
  accent,
  children,
  removed,
  onRemove,
  words,
  highlighted,
}: {
  /** Names this section, so a refine can say it changed and scroll to it. */
  id?: string;
  eyebrow: string;
  tint: "coral" | "violet" | "paper";
  accent: "coral" | "violet";
  children: React.ReactNode;
  /** Present only on sections that can be taken out. */
  onRemove?: (removed: boolean) => void;
  removed?: boolean;
  words?: { remove: string; removed: string; restore: string };
  /** Just rewritten by a refine. Fades out on its own. */
  highlighted?: boolean;
}) {
  const tintClass = tint === "coral" ? "bg-coral-tint" : tint === "violet" ? "bg-violet-tint" : "bg-paper";
  const accentClass = accent === "coral" ? "border-coral" : "border-violet";

  if (removed && onRemove && words) {
    return (
      <div
        data-section={id}
        className="rounded-card border border-dashed border-line px-5 py-3 flex flex-wrap items-center justify-between gap-2"
      >
        <span className="font-body font-bold text-caption tracking-[0.08em] uppercase text-text-muted">
          {eyebrow} · {words.removed}
        </span>
        <button
          type="button"
          onClick={() => onRemove(false)}
          className="font-body font-semibold text-caption text-violet hover:underline bg-none border-none p-0 cursor-pointer tap-row"
        >
          {words.restore}
        </button>
      </div>
    );
  }

  return (
    <div
      data-section={id}
      className={`${tintClass} rounded-card border-l-[3px] ${accentClass} px-5 py-4 ${
        highlighted ? "just-changed" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-body font-bold text-caption tracking-[0.08em] uppercase text-slate">
          {eyebrow}
        </span>
        {onRemove && words && (
          <button
            type="button"
            onClick={() => onRemove(true)}
            className="font-body text-caption text-text-muted hover:text-overdue bg-none border-none p-0 cursor-pointer shrink-0 tap-row"
          >
            {words.remove}
          </button>
        )}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Bullets({ items, dense }: { items: string[]; dense?: boolean }) {
  return (
    <ul className={`list-none p-0 m-0 flex flex-col ${dense ? "gap-1.5" : "gap-2"}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-body leading-relaxed text-ink">
          <span className="text-coral font-bold shrink-0">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * What each section is called, for the line that says what a refine changed.
 *
 * Its own map rather than reusing the eyebrows, because those are the client's
 * words on the document and this is a sentence addressed to the freelancer.
 */
/** Free text back into a list, the same way deliverables are parsed. */
function linesOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*\u2022]\s*/, "").trim())
    .filter(Boolean);
}

function sectionName(key: string, t: ReturnType<typeof useT>): string {
  switch (key) {
    case "overview":
      return t.brief.changedOverview;
    case "strategy":
      return t.publicQuote.strategy;
    case "scope":
      return t.publicQuote.scope;
    case "deliverables":
      return t.publicQuote.deliverables;
    case "timeline":
      return t.publicQuote.timeline;
    case "paymentTerms":
      return t.publicQuote.paymentTerms;
    case "revisions":
      return t.publicQuote.revisions;
    case "availability":
      return t.publicQuote.availability;
    case "assumptions":
      return t.publicQuote.assumptions;
    case "scopeChanges":
      return t.publicQuote.scopeChanges;
    case "aiUsage":
      return t.quote.sectionAi;
    case "terms":
      return t.quote.sectionTerms;
    default:
      return key;
  }
}

/**
 * The five layouts, in the order they read from most to least dressed.
 *
 * The two mono presets are stored as a branding and behave as a layout, so
 * this is where the two ideas are reconciled. See chooseLayout.
 */
const LAYOUTS = [
  { id: "classic", labelKey: "templateClassic" },
  { id: "editorial", labelKey: "templateEditorial" },
  { id: "minimal", labelKey: "templateMinimal" },
  { id: "mono-light", labelKey: "brandMonoLight" },
  { id: "mono-dark", labelKey: "brandMonoDark" },
] as const;

export function BriefView({
  brief,
  brand,
  disciplines = [],
  rules,
}: {
  brief: Brief;
  /** Everything this account does, for correcting the guess. */
  disciplines?: { key: string; label: string }[];
  /** The account's saved colours and logo, for the "own branding" preview. */
  brand: BrandSource;
  /** Which ground rules this account keeps, and its one number. */
  rules: RuleSettings;
}) {
  const router = useRouter();
  const t = useT();
  const [refinePrompt, setRefinePrompt] = useState("");
  /**
   * Which kind of work this quote is, as decided when it was written.
   *
   * Held locally so a correction lands at once. It matters more than a label
   * looks like it should: the next quote's pricing anchors on the quotes tagged
   * with the same discipline, so a wrong tag today skews a price next month.
   */
  const [discipline, setDiscipline] = useState(brief.discipline ?? "");
  /**
   * The second half, asked for from here.
   *
   * The quote is written in two calls and the page opens after the first, so
   * the sections that describe the money and the terms arrive while somebody
   * is already reading the scope. Asked for once per page load, guarded by a
   * ref because React runs an effect twice in development and paying for a
   * second model call to discover that is an expensive way to learn it.
   */
  const [writingExtras, setWritingExtras] = useState(Boolean(brief.extrasPending));
  const askedForExtras = useRef(false);
  /**
   * What the last refine changed, until the highlight has had its moment.
   *
   * Held here rather than read off the page, because after the refresh the
   * page only has the new version and nothing to compare it to. The action
   * does the comparing, where both versions exist.
   */
  const [justChanged, setJustChanged] = useState<string[]>([]);
  /**
   * The last refine's result, kept after the highlight fades.
   *
   * Separate from justChanged because an empty list means two different things
   * at two different times: nothing has been refined yet, and a refine that
   * changed nothing. Null is the first, an empty array is the second, and the
   * second deserves saying out loud.
   */
  const [refined, setRefined] = useState<string[] | null>(null);
  /**
   * Which half a phone is showing.
   *
   * Side by side is impossible at that width, and editing is the thing you
   * would actually be doing on a phone. Checking how the document looks is a
   * laptop job, done once before sending.
   */
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  /**
   * The chosen style and brand, kept locally so the preview redraws at once.
   *
   * Saved in the background. Waiting on a round trip to see a different
   * template would make trying three of them feel like three page loads, and
   * the worst case is one chip out of step until a reload.
   */
  const [look, setLookState] = useState({
    template: brief.template ?? "classic",
    branding: brief.branding ?? "freely",
  });

  function setLook(patch: Partial<typeof look>) {
    setLookState((current) => ({ ...current, ...patch }));
    void updateQuoteLookAction(brief.id, patch);
  }

  /**
   * Which sections have been taken out, held locally so a removal is instant.
   *
   * Same reasoning as the look: the content is untouched either way, so the
   * worst case of a failed save is a section reappearing on reload, which is
   * the safe direction for something that decides what the client receives.
   */
  const [hidden, setHidden] = useState<string[]>(brief.hiddenSections ?? []);

  const sectionWords = {
    remove: t.brief.sectionRemove,
    removed: t.brief.sectionRemoved,
    restore: t.brief.sectionRestore,
  };

  /** The remove/restore props for one section, or nothing when it is core. */
  function removable(key: HideableSection) {
    return {
      id: key,
      highlighted: justChanged.includes(key),
      removed: hidden.includes(key),
      words: sectionWords,
      onRemove: (off: boolean) => {
        setHidden((current) =>
          off ? Array.from(new Set([...current, key])) : current.filter((k) => k !== key)
        );
        void toggleSectionAction(brief.id, key, off);
      },
    };
  }

  /**
   * Layout and colour, as the two questions they actually are.
   *
   * The mono presets are stored as a branding, which is what they are in the
   * database, and they behave as a layout, because resolveBrand short-circuits
   * to MonoTemplate and the chosen template is never read. Offering them as a
   * colour meant Editorial plus Minimal dark silently produced neither.
   *
   * So the picker is honest about the behaviour and the storage is left alone:
   * choosing a mono layout sets the branding and choosing a real layout puts
   * the branding back to something that has colour in it.
   */
  const isMono = look.branding === "mono-light" || look.branding === "mono-dark";
  const layout = isMono ? look.branding : look.template;

  function chooseLayout(next: string) {
    if (next === "mono-light" || next === "mono-dark") {
      setLook({ branding: next });
      return;
    }
    setLook({ template: next, ...(isMono ? { branding: "freely" } : {}) });
  }
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  // Used for the actions that redirect, where a failure otherwise looks like
  // nothing happening at all.
  const { run: track, error: trackError } = useAction();
  const [published, setPublished] = useState(brief.published);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Held locally so an edit appears instantly. The server action persists in
  // the background and only surfaces if it fails.
  const [content, setContent] = useState({
    title: brief.title,
    client: brief.client,
    scope: brief.scope,
    deliverables: brief.deliverables,
    timeline: brief.timeline,
    extras: brief.extras ?? null,
    strategy: brief.strategy ?? null,
    price: brief.price,
    hours: brief.hours,
  });

  /**
   * Taking the server's copy back after a rewrite.
   *
   * The editor holds the quote in state so a save feels instant, which means a
   * refine landing on the server changed nothing on screen until a reload: the
   * new sections were in the database and the page was still showing what it
   * had. Keyed on the version stamp rather than on the whole object, so an
   * edit somebody is in the middle of typing is not thrown away by a refresh
   * that changed nothing.
   */
  useEffect(() => {
    setContent({
      title: brief.title,
      client: brief.client,
      scope: brief.scope,
      deliverables: brief.deliverables,
      timeline: brief.timeline,
      extras: brief.extras ?? null,
      strategy: brief.strategy ?? null,
      price: brief.price,
      hours: brief.hours,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.updatedAt]);

  async function saveContent(patch: Parameters<typeof updateBriefContentAction>[1]) {
    setContent((c) => ({
      ...c,
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.client !== undefined ? { client: patch.client } : {}),
      ...(patch.scope !== undefined ? { scope: patch.scope } : {}),
      ...(patch.deliverables !== undefined ? { deliverables: patch.deliverables } : {}),
      ...(patch.timeline !== undefined ? { timeline: patch.timeline } : {}),
      ...(patch.extras !== undefined ? { extras: patch.extras } : {}),
      ...(patch.strategy !== undefined ? { strategy: patch.strategy } : {}),
      ...(patch.price !== undefined ? { price: patch.price } : {}),
      ...(patch.hours !== undefined ? { hours: patch.hours } : {}),
    }));
    const result = await updateBriefContentAction(brief.id, patch);
    if (!result.ok) setError(result.error);
  }

  const [showSource, setShowSource] = useState(false);
  const [examples, setExamples] = useState(brief.examples);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the link is right there to copy by
      // hand, so there's nothing useful to say here.
    }
  }

  async function handleTogglePublish() {
    setPublishing(true);
    const result = await setBriefPublishedAction(brief.id, !published);
    setPublishing(false);
    if (result.ok) setPublished(!published);
  }

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/q/${brief.publicSlug}` : `/q/${brief.publicSlug}`;

  useEffect(() => {
    if (!brief.extrasPending || askedForExtras.current) return;
    askedForExtras.current = true;
    void (async () => {
      const result = await generateExtrasAction(brief.id);
      setWritingExtras(false);
      // A failure here is not worth an error banner: the quote is complete
      // enough to read and to send, and the missing sections can be asked for
      // again with a refine.
      if (result.ok) router.refresh();
    })();
  }, [brief.extrasPending, brief.id, router]);

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
    showChanged(result.data.changed);
  }

  /**
   * What a rewrite changed, said out loud.
   *
   * Shared by the refine box and by a ground rule writing its own clause in:
   * both end with parts of the quote replaced somewhere off screen, and a
   * spinner that simply stops says something finished rather than what it did.
   */
  function showChanged(changed: string[]) {
    router.refresh();
    setJustChanged(changed);
    setRefined(changed);
    if (changed.length > 0) {
      // After the refresh has painted, or the section being scrolled to is the
      // old one and it is about to be replaced under the scroll.
      window.setTimeout(() => {
        const first = document.querySelector(`[data-section="${changed[0]}"]`);
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 350);
    }
    // Long enough to find it, short enough that it is gone before it becomes
    // part of how the page looks.
    window.setTimeout(() => setJustChanged([]), 6000);
  }

  async function handleAddToTrack() {
    setWorking(true);
    // The action redirects on success, so reaching the next line means it
    // failed. This used to leave the button stuck on its working state with
    // nothing said.
    await track(
      async () => {
        await addBriefToTrackAction(brief.id);
        return { ok: true as const, data: undefined };
      },
      { skipRefresh: true, errorMessage: "Couldn't send that to Track. Try again." }
    );
    setWorking(false);
  }

  async function handleDeleteExample(id: string) {
    const previous = examples;
    setExamples((prev) => prev.filter((e) => e.id !== id));
    const result = await deleteBriefExampleAction(id);
    // Put it back if the delete did not take, rather than showing it gone.
    if (!result.ok) {
      setExamples(previous);
      setError(result.error);
    }
  }

  /**
   * The quote in the shape the templates read.
   *
   * Built from `content`, which is what the editor writes when a section is
   * saved, so the preview redraws as edits land rather than on every keystroke.
   */
  const previewBrief: PublicBrief = applyHiddenSections({
    title: content.title,
    client: content.client,
    scope: content.scope,
    deliverables: content.deliverables,
    timeline: content.timeline,
    strategy: content.strategy ?? null,
    milestones: brief.milestones,
    layout: brief.layout,
    billing: brief.billing ?? null,
    milestonesBillable: brief.milestonesBillable,
    extras: content.extras ?? null,
    price: content.price,
    hours: content.hours,
    rateUnit: brief.rateUnit ?? "HOUR",
    language: brief.language ?? "en",
    hourlyRate: brief.hourlyRate ?? null,
    currency: brief.currency ?? "USD",
    examples: brief.examples ?? [],
    slug: brief.publicSlug,
    signable: Boolean(brief.signable),
    accepted: brief.accepted
      ? { name: brief.accepted.name, at: brief.accepted.at }
      : null,
  }, hidden);

  return (
    <>
      <Topbar />

      {/* This page is a working view, not the finished article: it shows the
          content without any branding applied. That was reading as "done",
          so the state is now stated outright rather than implied by a stamp. */}
      {brief.accepted && (
        <div className="flex items-start gap-2.5 bg-mint-solid rounded-card px-4 py-3">
          <Check size={15} className="text-success shrink-0 mt-0.5" />
          <div className="text-small text-ink">
            <span className="font-semibold">Accepted by {brief.accepted.name}</span> on{" "}
            {new Date(brief.accepted.at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {brief.accepted.email ? ` (${brief.accepted.email})` : ""}. The published page records
            it.
          </div>
        </div>
      )}

      {/* What kind of work this is, and one press to disagree. Only when the
          account does more than one, since with one there is nothing to name
          and nothing to get wrong. */}
      {disciplines.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-caption text-text-muted">{t.brief.quotedAs}</span>
          <div className="flex flex-wrap gap-1.5">
            {disciplines.map((option) => (
              <Chip
                key={option.key}
                active={discipline === option.key}
                onClick={() => {
                  setDiscipline(option.key);
                  void setQuoteDisciplineAction(brief.id, option.key);
                }}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* The second half, arriving. Said plainly and without a spinner over the
          whole page: what is here is finished and readable, and the sections
          still being written are the ones nobody has scrolled to yet. */}
      {writingExtras && (
        <div className="flex items-start gap-2.5 bg-violet-tint rounded-card px-4 py-3">
          <Sparkles size={15} className="text-violet shrink-0 mt-0.5 animate-pulse motion-reduce:animate-none" />
          <div className="text-small text-ink">
            <span className="font-semibold">{t.brief.stillWriting}</span> {t.brief.stillWritingHint}
          </div>
        </div>
      )}

      {!published && !brief.accepted && (
        <div className="flex items-start gap-2.5 bg-coral-tint rounded-card px-4 py-3">
          <Eye size={15} className="text-coral shrink-0 mt-0.5" />
          <div className="text-small text-ink">
            <span className="font-semibold">{t.brief.workingDraft}</span> Nobody else can see
            it yet, and your branding isn&apos;t applied here. Publish it as a page or download the
            PDF to see how the client will actually receive it.
          </div>
        </div>
      )}

      {/* The cover, full width, with the checklist reduced to one control in
          its corner. The checklist held a column beside this and gave five
          private notes the same room as the quote itself. It opens itself
          once, a couple of seconds in, and lives in an overlay after that. */}
      <div
        data-section="overview"
        className={`bg-ink rounded-card px-5 py-5 md:px-7 md:py-6 flex justify-between items-start gap-4 ${
          justChanged.includes("overview") ? "just-changed" : ""
        }`}
      >
        <div>
          <span className="font-body font-bold text-caption tracking-[0.08em] uppercase text-coral-light">
            {published ? "Quotation, published" : "Quotation, draft"}
          </span>
          <EditableSection
            tone="dark"
            editLabel={t.brief.editOverview}
            fields={[
              { key: "title", label: "Title", value: content.title },
              { key: "client", label: "Client", value: content.client },
              { key: "price", label: "Total price", value: String(content.price), numeric: true },
              {
                key: "hours",
                label: "Estimated hours",
                // Always hours here: days are derived from them, so editing
                // the underlying number is what keeps the two in step.
                value: String(content.hours),
                numeric: true,
                hint:
                  parseRateUnit(brief.rateUnit) === "DAY"
                    ? "In hours. The quote shows days, worked out from these."
                    : undefined,
              },
            ]}
            onSave={(values) => {
              const hours = Number(values.hours);
              const typedPrice = Number(values.price);
              // If they changed the price themselves in the same edit, that
              // is the number they want. Otherwise the price follows the
              // hours at the rate this quote runs at.
              const priceUntouched = typedPrice === content.price;
              const repriced = priceUntouched
                ? repriceForHours(hours, content.price, content.hours, brief.hourlyRate)
                : null;
              return saveContent({
                title: values.title,
                client: values.client,
                price: repriced ? repriced.price : typedPrice,
                hours,
              });
            }}
          >
            <h1 className="font-display italic text-[28px] text-white m-0 mt-1">{content.title}</h1>
            <p className="text-small text-white/60 mt-1.5">{content.client}</p>
            <p className="text-meta text-white/40 mt-1">
              Generated {new Date(brief.createdAt).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-5 md:gap-7 mt-4">
              <div>
                <div className="font-body font-bold text-[20px] text-white">
                  {currencySymbol(brief.currency)}
                  {content.price.toLocaleString()}
                </div>
                <div className="text-caption uppercase tracking-[0.06em] text-white/60">{t.brief.total}</div>
              </div>
              <div>
                <div className="font-body font-bold text-[20px] text-white">
                  {effortShort(content.hours, parseRateUnit(brief.rateUnit))}
                </div>
                <div className="text-caption uppercase tracking-[0.06em] text-white/60">
                  {effortLabel(parseRateUnit(brief.rateUnit), t.publicQuote)}
                </div>
              </div>
              {brief.hourlyRate && (
                <div>
                  <div className="font-body font-bold text-[20px] text-white">
                    {currencySymbol(brief.currency)}
                    {brief.hourlyRate}
                  </div>
                  <div className="text-caption uppercase tracking-[0.06em] text-white/60">
                    {rateLabel(parseRateUnit(brief.rateUnit), t.publicQuote)}
                  </div>
                </div>
              )}
            </div>
          </EditableSection>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-3">
          <span className="font-body font-semibold text-caption uppercase tracking-wide text-white/60">
            {brief.accepted ? "Accepted" : published ? "Published" : "Draft"}
          </span>
          <BeforeYouSend
            briefId={brief.id}
            questions={content.strategy?.openQuestions ?? []}
            cleared={brief.clearedQuestions ?? []}
            // Checked against the quote as it stands, so editing a section
            // clears its flag without a reload.
            broken={brokenRules(
              {
                extras: content.extras ?? null,
                hours: content.hours,
                price: content.price,
                rateUnit: brief.rateUnit ?? "HOUR",
                billing: brief.billing ?? null,
                paymentPlan: brief.paymentPlan ?? null,
                protection: brief.protection ?? null,
                milestoneCount: brief.milestones?.length ?? 0,
                hidden,
              },
              rules
            )}
            acknowledged={brief.rulesAcknowledged ?? []}
            onFixed={showChanged}
          />
        </div>
      </div>

      {/* Two halves on a laptop, one at a time on a phone. */}
      <div className="flex lg:hidden gap-1.5 mt-5">
        {([
          ["edit", t.brief.tabEdit],
          ["preview", t.brief.tabPreview],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            aria-pressed={mobileTab === id}
            className={`flex-1 font-body font-semibold text-small rounded-lg py-2.5 border-none cursor-pointer tap-row transition-colors ${
              mobileTab === id ? "bg-violet text-white" : "bg-paper text-slate"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 mt-5">
        <div
          className={`min-w-0 flex-1 flex flex-col gap-[18px] ${
            mobileTab === "edit" ? "flex" : "hidden"
          } lg:flex`}
        >
          {/* Said once, where the editing happens. Changing a published quote
              is allowed, because unpublishing to fix a comma is a thing people
              route around. Doing it silently is not. */}
          {brief.published && (
            <p className="text-caption text-overdue m-0 text-pretty">{t.brief.editingLive}</p>
          )}
          {hasStrategyContent(content.strategy) && (
            <Section eyebrow={t.publicQuote.strategy} tint="violet" accent="violet" {...removable("strategy")}>
              <p className="text-meta text-slate mb-3">
                {t.brief.whatTheAiUnderstood}
              </p>
              <EditableSection
                editLabel="Edit strategy"
                fields={[
                  { key: "goal", label: "Goal", value: content.strategy.goal, multiline: true },
                  {
                    key: "findings",
                    label: t.publicQuote.findings,
                    value: content.strategy.findings.join("\n"),
                    multiline: true,
                    hint: "One finding per line.",
                  },
                ]}
                onSave={(values) =>
                  saveContent({
                    strategy: {
                      ...content.strategy!,
                      goal: values.goal,
                      findings: values.findings
                        .split("\n")
                        .map((l) => l.replace(/^[-*\u2022\u00b7]\s*/, "").trim())
                        .filter(Boolean),
                    },
                  })
                }
              >
                <p className="text-sm leading-relaxed m-0 text-ink font-medium">
                  {content.strategy.goal}
                </p>
                {content.strategy.findings.length > 0 && (
                  <div className="mt-3">
                    <span className="text-caption font-bold text-slate uppercase tracking-[0.04em]">
                      {t.publicQuote.findings}
                    </span>
                    <div className="mt-1.5">
                      <Bullets items={content.strategy.findings} />
                    </div>
                  </div>
                )}
              </EditableSection>
            </Section>
          )}

          <Section eyebrow={t.publicQuote.scope} tint="paper" accent="coral" id="scope" highlighted={justChanged.includes("scope")}>
            <EditableBlock
              value={content.scope}
              onSave={(scope) => saveContent({ scope })}
              ariaLabel="Scope"
            >
              <div className="flex flex-col gap-3">
                {paragraphs(content.scope).map((p, i) => (
                  <p key={i} className="text-lead leading-[1.7] text-ink m-0">
                    {p}
                  </p>
                ))}
              </div>
            </EditableBlock>
          </Section>

          <Section eyebrow={t.publicQuote.deliverables} tint="coral" accent="coral" id="deliverables" highlighted={justChanged.includes("deliverables")}>
            <EditableBlock
              value={content.deliverables.join("\n")}
              onSave={(next) =>
                saveContent({
                  deliverables: next
                    .split("\n")
                    .map((line) => line.replace(/^[-*\u2022]\s*/, "").trim())
                    .filter(Boolean),
                })
              }
              ariaLabel="Deliverables"
              hint={t.brief.oneDeliverablePerLine}
            >
              <DeliverableList
                deliverables={content.deliverables}
                marker={() => <CheckCircle2 size={14} className="text-coral shrink-0 mt-0.5" />}
              />
            </EditableBlock>
          </Section>

          {brief.milestones && brief.milestones.length > 0 && (
            <Section eyebrow={t.quote.milestonesSection} tint="paper" accent="violet">
              <div className="flex flex-col gap-2.5">
                {brief.milestones.map((ms, i) => (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-3 pb-2.5 border-b border-line last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="font-body font-semibold text-body text-ink">{ms.name}</div>
                      {/* Named, not counted. "3 deliverables" is a number;
                          the names are what tells you the split is right. */}
                      <div className="text-caption text-slate mt-0.5 leading-relaxed">
                        {ms.deliverableIndexes
                          // content, not brief: an edited deliverable name
                          // should show here at once rather than after a
                          // refresh, the same as it does in the preview.
                          .map((n) => content.deliverables[n])
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                      {/* The gate, which is the reason the split falls here.
                          Set apart because it is usually the client's move,
                          and a schedule that does not say so gets blamed on
                          the freelancer when it slips. */}
                      {ms.gate && (
                        <div className="text-caption text-violet mt-1 font-semibold">
                          {t.quote.milestoneEndsWith}: {ms.gate}
                        </div>
                      )}
                    </div>
                    <div className="font-body font-bold text-small text-ink tabular-nums shrink-0">
                      {currencySymbol(brief.currency)}
                      {ms.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section eyebrow={t.publicQuote.timeline} tint="paper" accent="violet" {...removable("timeline")}>
            <EditableBlock
              value={content.timeline}
              onSave={(timeline) => saveContent({ timeline })}
              ariaLabel="Timeline"
              hint={'One stage per line, as "Week 1-2: Label - what happens".'}
            >
              <TimelineView
                timeline={content.timeline}
                total={timelineTotal(content.timeline, t.publicQuote)}
                className="text-ink"
              />
            </EditableBlock>
          </Section>

          {content.extras?.paymentTerms && (
            <Section eyebrow={t.publicQuote.paymentTerms} tint="paper" accent="violet" {...removable("paymentTerms")}>
              <EditableBlock
                value={content.extras.paymentTerms}
                onSave={(next) =>
                  saveContent({ extras: { ...content.extras, paymentTerms: next } })
                }
                ariaLabel="Payment terms"
                className="text-sm leading-relaxed text-ink"
              />
              <p className="text-xs text-text-muted mt-2 m-0">
                {t.brief.bankDetailsOnInvoice}
              </p>
            </Section>
          )}

          {content.extras?.revisions && (
            <Section eyebrow={t.publicQuote.revisions} tint="paper" accent="violet" {...removable("revisions")}>
              <EditableBlock
                value={content.extras.revisions}
                onSave={(next) =>
                  saveContent({ extras: { ...content.extras, revisions: next } })
                }
                ariaLabel="Revisions"
                className="text-sm leading-relaxed text-ink"
              />
            </Section>
          )}

          {content.extras?.availability && (
            <Section eyebrow={t.publicQuote.availability} tint="paper" accent="violet" {...removable("availability")}>
              <EditableBlock
                value={content.extras.availability}
                onSave={(next) =>
                  saveContent({ extras: { ...content.extras, availability: next } })
                }
                ariaLabel="Availability"
                className="text-sm leading-relaxed text-ink"
              />
            </Section>
          )}

          {/* Two lists rather than prose, and edited as lines, because that is
              how they are read: a client checks an assumption against what
              they know and either agrees with it or corrects it. */}
          {content.extras?.assumptions?.length ? (
            <Section
              eyebrow={t.publicQuote.assumptions}
              tint="paper"
              accent="violet"
              {...removable("assumptions")}
            >
              <EditableBlock
                value={content.extras.assumptions.join("\n")}
                onSave={(next) =>
                  saveContent({
                    extras: { ...content.extras, assumptions: linesOf(next) },
                  })
                }
                ariaLabel="Assumptions"
                hint={t.brief.onePerLine}
              >
                <DeliverableList deliverables={content.extras.assumptions} />
              </EditableBlock>
            </Section>
          ) : null}

          {content.extras?.scopeChanges?.length ? (
            <Section
              eyebrow={t.publicQuote.scopeChanges}
              tint="paper"
              accent="violet"
              {...removable("scopeChanges")}
            >
              <EditableBlock
                value={content.extras.scopeChanges.join("\n")}
                onSave={(next) =>
                  saveContent({
                    extras: { ...content.extras, scopeChanges: linesOf(next) },
                  })
                }
                ariaLabel="What would change the price"
                hint={t.brief.onePerLine}
              >
                <DeliverableList deliverables={content.extras.scopeChanges} />
              </EditableBlock>
            </Section>
          ) : null}

          {content.extras?.aiUsage && (
            <Section eyebrow={t.quote.sectionAi} tint="paper" accent="violet" {...removable("aiUsage")}>
              <EditableSection
                editLabel="Edit AI use"
                fields={[
                  {
                    key: "will",
                    label: t.publicQuote.aiWhereUsed,
                    value: content.extras.aiUsage.will.join("\n"),
                    multiline: true,
                    hint: "One per line.",
                  },
                  {
                    key: "willNot",
                    label: t.publicQuote.aiWhereNot,
                    value: content.extras.aiUsage.willNot.join("\n"),
                    multiline: true,
                    hint: "One per line.",
                  },
                ]}
                onSave={(values) =>
                  saveContent({
                    extras: {
                      ...content.extras,
                      aiUsage: {
                        will: values.will.split("\n").map((l) => l.trim()).filter(Boolean),
                        willNot: values.willNot.split("\n").map((l) => l.trim()).filter(Boolean),
                      },
                    },
                  })
                }
              >
                <div className="flex flex-col gap-3">
                  <div>
                    <span className="text-caption font-bold text-slate uppercase tracking-[0.04em]">
                      {t.publicQuote.aiWhereUsed}
                    </span>
                    <div className="mt-1.5">
                      <Bullets items={content.extras.aiUsage.will} dense />
                    </div>
                  </div>
                  <div>
                    <span className="text-caption font-bold text-slate uppercase tracking-[0.04em]">
                      {t.publicQuote.aiWhereNot}
                    </span>
                    <div className="mt-1.5">
                      <Bullets items={content.extras.aiUsage.willNot} dense />
                    </div>
                  </div>
                </div>
              </EditableSection>
            </Section>
          )}

          {content.extras?.terms && (
            <Section eyebrow={t.quote.sectionTerms} tint="paper" accent="violet" {...removable("terms")}>
              <div className="flex flex-col gap-2.5">
                {(
                  [
                    ["Cancellation", "cancellation"],
                    ["Ownership", "ownership"],
                    ["Confidentiality", "confidentiality"],
                  ] as const
                ).map(([label, field]) => (
                  <div key={field}>
                    <span className="text-caption font-bold text-slate uppercase tracking-[0.04em]">
                      {label}
                    </span>
                    <div className="mt-0.5">
                      <EditableBlock
                        value={content.extras!.terms![field]}
                        onSave={(next) =>
                          saveContent({
                            extras: {
                              ...content.extras,
                              terms: { ...content.extras!.terms!, [field]: next },
                            },
                          })
                        }
                        ariaLabel={label}
                        className="text-body text-ink leading-relaxed"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className="bg-ink rounded-card px-5 py-4 flex justify-between items-start gap-6">
            <div className="min-w-0">
              <span className="font-body font-bold text-caption tracking-[0.08em] uppercase text-white/60">
                {t.publicQuote.investment}
              </span>
              <div className="mt-1 max-w-[160px]">
                <EditableBlock
                  value={String(content.hours)}
                  onSave={(next) => {
                    const hours = Number(next);
                    if (!Number.isFinite(hours) || hours < 0) {
                      setError(t.brief.hoursNeedNumber);
                      return;
                    }
                    const repriced = repriceForHours(
                      hours,
                      content.price,
                      content.hours,
                      brief.hourlyRate,
                      parseRateUnit(brief.rateUnit)
                    );
                    saveContent(repriced ? { hours, price: repriced.price } : { hours });
                  }}
                  hint={
                    effectiveRate(
                      content.price,
                      content.hours,
                      brief.hourlyRate,
                      parseRateUnit(brief.rateUnit)
                    ) > 0
                      ? `The total updates to match, at ${currencySymbol(
                          brief.currency
                        )}${Math.round(
                          effectiveRate(
                            content.price,
                            content.hours,
                            brief.hourlyRate,
                            parseRateUnit(brief.rateUnit)
                          )
                        )}${rateSuffix(parseRateUnit(brief.rateUnit), t.publicQuote)}.`
                      : undefined
                  }
                  ariaLabel="Estimated hours"
                  className="text-small text-white/80"
                  singleLine
                >
                  <span>
                    {describeEffort(content.hours, parseRateUnit(brief.rateUnit), t.publicQuote)}
                    {effectiveRate(
                      content.price,
                      content.hours,
                      brief.hourlyRate,
                      parseRateUnit(brief.rateUnit)
                    ) > 0
                      ? ` · ${currencySymbol(brief.currency)}${Math.round(
                          effectiveRate(
                            content.price,
                            content.hours,
                            brief.hourlyRate,
                            parseRateUnit(brief.rateUnit)
                          )
                        )}${rateSuffix(parseRateUnit(brief.rateUnit), t.publicQuote)}`
                      : ""}
                  </span>
                </EditableBlock>
              </div>
            </div>
            <div className="max-w-[190px] text-right">
              <EditableBlock
                value={String(content.price)}
                onSave={(next) => {
                  const price = Number(next);
                  if (!Number.isFinite(price) || price < 0) {
                    setError(t.brief.priceNeedNumber);
                    return;
                  }
                  saveContent({ price });
                }}
                ariaLabel="Total price"
                className="font-body font-bold text-[24px] text-white"
                singleLine
              >
                <span>
                  {currencySymbol(brief.currency)}
                  {content.price.toLocaleString()}
                </span>
              </EditableBlock>
            </div>
          </div>

          {examples.length > 0 && (
            <Section eyebrow={t.publicQuote.examples} tint="paper" accent="coral">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {examples.map((ex) => (
                  <div key={ex.id} className="bg-white rounded-lg overflow-hidden border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ex.dataUrl} alt={ex.name} className="w-full h-[110px] object-cover" />
                    <div className="p-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-caption font-bold text-ink">{ex.name}</span>
                        <button
                          onClick={() => handleDeleteExample(ex.id)}
                          className="bg-none border-none cursor-pointer p-0 tap text-slate hover:text-overdue"
                          aria-label={t.quote.removeExample}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <p className="text-meta leading-snug text-slate mt-1.5 m-0">{ex.caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}


          {/* Where this came from and how to change it. Below the document
              rather than beside it: these belong to editing, and a third
              column would squeeze the preview until a scaled page is
              unreadable. */}
          <Card>
            <Label>{t.brief.refine}</Label>
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

            {/* What it did, in words, next to the button that did it. The
                highlight on the section says where; this says what, and stays
                readable after the highlight has faded. */}
            {refined && (
              <p className="text-caption text-slate mt-2.5 mb-0 text-pretty">
                {refined.length === 0
                  ? t.brief.refineNothing
                  : t.brief.refineChanged.replace(
                      "{list}",
                      refined.map((key) => sectionName(key, t)).join(", ")
                    )}
                {refined.length > 0 && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => {
                        document
                          .querySelector(`[data-section="${refined[0]}"]`)
                          ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className="font-semibold text-violet bg-none border-none p-0 cursor-pointer tap"
                    >
                      {t.brief.refineShowMe}
                    </button>
                  </>
                )}
              </p>
            )}
            <ActionError error={error || trackError} className="mt-2" />
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
                  <Label>{t.brief.originalRequest}</Label>
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate transition-transform ${showSource ? "rotate-180" : ""}`}
                />
              </button>
              {showSource && (
                <p className="text-small leading-relaxed text-slate mt-2.5 max-h-[220px] overflow-y-auto whitespace-pre-line">
                  {brief.sourceText}
                </p>
              )}
            </Card>
          )}
          {/* No list of past quotes here. This column is for working on this
              quote, and a dozen other titles under it was navigation wearing
              the same card as the editor. Quote > All does that job. */}
        </div>

        {/* The quote as the client will see it, in the template that will be
            used, scaled to fit. This is the whole reason for the split: the
            page where somebody decides a quote is good enough to send used to
            draw its own approximation while the client received one of three
            real templates. */}
        <div className={`min-w-0 flex-1 ${mobileTab === "preview" ? "block" : "hidden"} lg:block`}>
          <div className="lg:sticky lg:top-5 flex flex-col gap-3">
            {/* Two questions, labelled, because eight chips in one row read as
                one list of eight equal things and they are not.

                The two Minimal options live under Layout rather than Colour,
                which is where they actually belong: they render their own
                template and ignore whichever layout is chosen, so offering
                them as a colour meant picking Editorial and Minimal dark
                together and quietly getting neither. Now they are layouts, and
                choosing one is choosing a layout. */}
            <div className="flex flex-col gap-2.5">
              <div>
                <SubLabel className="mb-1.5">{t.brief.lookLayout}</SubLabel>
                <div className="flex flex-wrap gap-1.5">
                  {LAYOUTS.map(({ id, labelKey }) => (
                    <Chip key={id} active={layout === id} onClick={() => chooseLayout(id)}>
                      {t.quote[labelKey]}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Only where it can do anything. The mono layouts are black and
                  white by definition, so a colour picker beside one is a
                  control that does nothing. */}
              {!isMono && (
                <div>
                  <SubLabel className="mb-1.5">{t.brief.lookColour}</SubLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ["freely", t.quote.brandFreely],
                      ["own", t.quote.brandOwn],
                    ] as const).map(([value, label]) => (
                      <Chip
                        key={value}
                        active={look.branding === value}
                        onClick={() => setLook({ branding: value })}
                      >
                        {label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <QuotePreview>
              <RenderedQuote
                brief={previewBrief}
                branding={look.branding}
                template={look.template}
                user={brand}
              />
            </QuotePreview>
          </div>
        </div>
      </div>
      {/* Sharing the quote is the point of the page, so publishing is a real
          CTA here rather than a faint link tucked next to the stamp. Once
          it's live the button is replaced in place by the link itself, since
          that's what you came back for, with unpublish demoted underneath. */}
      <div className="flex flex-wrap justify-start md:justify-end items-start gap-3">
        <Button variant="ghost" onClick={() => router.push("/quote")}>
          {t.quote.newQuote}
        </Button>
        <DownloadPdfButton
          href={`/api/briefs/${brief.id}/pdf?template=${brief.template || "classic"}`}
          fileName={`${brief.title.replace(/[^\w\s-]/g, "").trim() || "quote"}.pdf`}
        />
        {brief.status === "DRAFT" && (
          <Button variant="outline" icon={Check} disabled={working} onClick={handleAddToTrack}>
            {t.brief.addToTrack}
          </Button>
        )}

        {published ? (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 bg-mint-solid rounded-lg pl-3.5 pr-2 py-2 max-w-[420px]">
              <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="text-small text-success font-semibold truncate hover:underline"
              >
                {shareUrl.replace(/^https?:\/\//, "")}
              </a>
              <button
                type="button"
                onClick={handleCopyLink}
                title={copied ? "Copied" : "Copy link"}
                className="text-success/70 hover:text-success bg-none border-none cursor-pointer p-1 shrink-0"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                title="Open page"
                className="text-success/70 hover:text-success p-1 shrink-0"
              >
                <ExternalLink size={13} />
              </a>
            </div>
            <button
              type="button"
              disabled={publishing}
              onClick={handleTogglePublish}
              className="text-meta text-text-muted hover:text-overdue underline bg-none border-none cursor-pointer p-0 tap"
            >
              {publishing ? "Working..." : "Unpublish"}
            </button>
          </div>
        ) : (
          // Held while the second half is still being written. The server
          // refuses it anyway; disabling here means the refusal never has to be
          // read, and the title says why rather than leaving a dead button.
          <Button
            icon={Link2}
            loading={publishing}
            disabled={writingExtras}
            title={writingExtras ? t.brief.stillWriting : undefined}
            onClick={handleTogglePublish}
            data-guide="publish"
          >
            {publishing ? "Publishing..." : "Publish as a page"}
          </Button>
        )}
      </div>
    </>
  );
}
