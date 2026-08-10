"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Check,
  Download,
  Link2,
  CheckCircle2,
  Trash2,
  ChevronDown,
  FileText,
  Copy,
  ExternalLink,
  Eye,
  Lightbulb,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import type { StampStatus } from "@/components/ui/stamp";
import {
  refineBriefAction,
  addBriefToTrackAction,
  setBriefPublishedAction,
  updateBriefContentAction,
  deleteBriefExampleAction,
} from "@/actions/briefs";
import { currencySymbol } from "@/lib/currencies";
import { TimelineView } from "@/components/timeline-view";
import type { BriefExtras } from "@/lib/anthropic";
import { EditableBlock, EditableSection } from "@/components/editable-text";

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
  status: StampStatus;
  createdAt: string;
  published: boolean;
  publicSlug: string;
  template?: string;
  sourceText?: string | null;
  accepted?: { name: string; email: string; at: string } | null;
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

  async function handleDeleteExample(id: string) {
    setExamples((prev) => prev.filter((e) => e.id !== id));
    await deleteBriefExampleAction(id);
  }

  return (
    <>
      <Topbar eyebrow={published ? "Quote - Published" : "Quote - Draft"} />

      {/* This page is a working view, not the finished article: it shows the
          content without any branding applied. That was reading as "done",
          so the state is now stated outright rather than implied by a stamp. */}
      {brief.accepted && (
        <div className="flex items-start gap-2.5 bg-mint-solid rounded-card px-4 py-3">
          <Check size={15} className="text-success shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-ink">
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

      {!published && !brief.accepted && (
        <div className="flex items-start gap-2.5 bg-coral-tint rounded-card px-4 py-3">
          <Eye size={15} className="text-coral shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-ink">
            <span className="font-semibold">This is your working draft.</span> Nobody else can see
            it yet, and your branding isn&apos;t applied here. Publish it as a page or download the
            PDF to see how the client will actually receive it.
          </div>
        </div>
      )}

      {/* Hero, mirrors a real quotation cover: dark block, big number stats */}
      <div className="bg-ink rounded-card px-5 py-5 md:px-7 md:py-6 flex justify-between items-start gap-4">
        <div>
          <span className="font-body font-bold text-[10px] tracking-[0.08em] uppercase text-coral">
            {published ? "Quotation, published" : "Quotation, draft"}
          </span>
          <EditableSection
            tone="dark"
            editLabel="Edit overview"
            fields={[
              { key: "title", label: "Title", value: content.title },
              { key: "client", label: "Client", value: content.client },
              { key: "price", label: "Total price", value: String(content.price), numeric: true },
              { key: "hours", label: "Estimated hours", value: String(content.hours), numeric: true },
            ]}
            onSave={(values) =>
              saveContent({
                title: values.title,
                client: values.client,
                price: Number(values.price),
                hours: Number(values.hours),
              })
            }
          >
            <h1 className="font-display italic text-[28px] text-white m-0 mt-1">{content.title}</h1>
            <p className="text-[13px] text-white/60 mt-1.5">{content.client}</p>
            <p className="text-[12px] text-white/40 mt-1">
              Generated {new Date(brief.createdAt).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-5 md:gap-7 mt-4">
              <div>
                <div className="font-body font-bold text-[20px] text-white">
                  {currencySymbol(brief.currency)}
                  {content.price.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase tracking-[0.06em] text-white/50">Total</div>
              </div>
              <div>
                <div className="font-body font-bold text-[20px] text-white">{content.hours}h</div>
                <div className="text-[10px] uppercase tracking-[0.06em] text-white/50">
                  Estimated hours
                </div>
              </div>
              {brief.hourlyRate && (
                <div>
                  <div className="font-body font-bold text-[20px] text-white">
                    {currencySymbol(brief.currency)}
                    {brief.hourlyRate}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.06em] text-white/50">
                    Per hour
                  </div>
                </div>
              )}
            </div>
          </EditableSection>
        </div>
        <span className="font-body font-semibold text-[11px] uppercase tracking-wide text-white/60 shrink-0">
          {brief.accepted ? "Accepted" : published ? "Published" : "Draft"}
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-5 flex-1 min-h-0 mt-5">
        <div className="flex-[2] flex flex-col gap-4 overflow-y-auto pr-1">
          {content.strategy && (
            <Section eyebrow="Strategy" tint="violet" accent="violet">
              <p className="text-[11.5px] text-slate mb-3">
                What the AI understood the project to be about, drawn from the brief you gave it.
                Edit anything that misses the mark.
              </p>
              <EditableSection
                editLabel="Edit strategy"
                fields={[
                  { key: "goal", label: "Goal", value: content.strategy.goal, multiline: true },
                  {
                    key: "findings",
                    label: "Findings",
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
                    <span className="text-[11px] font-bold text-slate uppercase tracking-[0.04em]">
                      Findings
                    </span>
                    <div className="mt-1.5">
                      <Bullets items={content.strategy.findings} />
                    </div>
                  </div>
                )}
              </EditableSection>
            </Section>
          )}

          <Section eyebrow="Scope" tint="paper" accent="coral">
            <EditableBlock
              value={content.scope}
              onSave={(scope) => saveContent({ scope })}
              ariaLabel="Scope"
              className="text-sm leading-relaxed text-ink"
            />
          </Section>

          <Section eyebrow="Deliverables" tint="coral" accent="coral">
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
              hint="One deliverable per line. Delete a line to remove it."
            >
              <div className="flex flex-col gap-2">
                {content.deliverables.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 text-[13.5px] text-ink font-medium">
                    <CheckCircle2 size={14} className="text-coral shrink-0 mt-0.5" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </EditableBlock>
          </Section>

          <Section eyebrow="Timeline" tint="paper" accent="violet">
            <EditableBlock
              value={content.timeline}
              onSave={(timeline) => saveContent({ timeline })}
              ariaLabel="Timeline"
              hint={'One stage per line, as "Week 1-2: Label - what happens".'}
            >
              <TimelineView timeline={content.timeline} className="text-ink" />
            </EditableBlock>
          </Section>

          {content.extras?.paymentTerms && (
            <Section eyebrow="Payment terms" tint="paper" accent="violet">
              <EditableBlock
                value={content.extras.paymentTerms}
                onSave={(next) =>
                  saveContent({ extras: { ...content.extras, paymentTerms: next } })
                }
                ariaLabel="Payment terms"
                className="text-sm leading-relaxed text-ink"
              />
              <p className="text-xs text-text-muted mt-2 m-0">
                Bank details go on the invoice.
              </p>
            </Section>
          )}

          {content.extras?.revisions && (
            <Section eyebrow="Revisions" tint="paper" accent="violet">
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
            <Section eyebrow="Availability" tint="paper" accent="violet">
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

          {content.extras?.aiUsage && (
            <Section eyebrow="How AI is used on this project" tint="paper" accent="violet">
              <EditableSection
                editLabel="Edit AI use"
                fields={[
                  {
                    key: "will",
                    label: "Where AI is used",
                    value: content.extras.aiUsage.will.join("\n"),
                    multiline: true,
                    hint: "One per line.",
                  },
                  {
                    key: "willNot",
                    label: "Where it is not",
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
                    <span className="text-[11px] font-bold text-slate uppercase tracking-[0.04em]">
                      Where AI is used
                    </span>
                    <div className="mt-1.5">
                      <Bullets items={content.extras.aiUsage.will} dense />
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate uppercase tracking-[0.04em]">
                      Where it is not
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
            <Section eyebrow="Terms" tint="paper" accent="violet">
              <div className="flex flex-col gap-2.5">
                {(
                  [
                    ["Cancellation", "cancellation"],
                    ["Ownership", "ownership"],
                    ["Confidentiality", "confidentiality"],
                  ] as const
                ).map(([label, field]) => (
                  <div key={field}>
                    <span className="text-[11px] font-bold text-slate uppercase tracking-[0.04em]">
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
                        className="text-[13.5px] text-ink leading-relaxed"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className="bg-ink rounded-card px-5 py-4 flex justify-between items-start gap-6">
            <div className="min-w-0">
              <span className="font-body font-bold text-[10px] tracking-[0.08em] uppercase text-white/50">
                Investment
              </span>
              <div className="mt-1 max-w-[160px]">
                <EditableBlock
                  value={String(content.hours)}
                  onSave={(next) => {
                    const hours = Number(next);
                    if (!Number.isFinite(hours) || hours < 0) {
                      setError("Hours needs to be a number.");
                      return;
                    }
                    saveContent({ hours });
                  }}
                  ariaLabel="Estimated hours"
                  className="text-[13px] text-white/80"
                  singleLine
                >
                  <span>
                    {content.hours} hours
                    {brief.hourlyRate
                      ? ` · ~${currencySymbol(brief.currency)}${brief.hourlyRate}/hr`
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
                    setError("Price needs to be a number.");
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
            <Section eyebrow="Examples" tint="paper" accent="coral">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <p className="text-[12px] leading-snug text-slate mt-1.5 m-0">{ex.caption}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* For the freelancer, not the client. Kept visually distinct from
              the quote sections above and never rendered on the public page or
              in the PDF. */}
          {content.strategy && content.strategy.openQuestions.length > 0 && (
            <div className="rounded-card border border-dashed border-violet/40 bg-white px-5 py-4">
              <div className="flex items-center gap-1.5">
                <Lightbulb size={14} className="text-violet" />
                <span className="font-body font-bold text-[10px] tracking-[0.08em] uppercase text-violet">
                  Worth thinking about
                </span>
              </div>
              <p className="text-[11.5px] text-slate mt-1.5 mb-3">
                Notes for you, not for the client. These do not appear on the quote you send.
              </p>
              <EditableBlock
                value={content.strategy.openQuestions.join("\n")}
                onSave={(next) =>
                  saveContent({
                    strategy: {
                      ...content.strategy!,
                      openQuestions: next
                        .split("\n")
                        .map((l) => l.replace(/^[-*\u2022\u00b7]\s*/, "").trim())
                        .filter(Boolean),
                    },
                  })
                }
                ariaLabel="Notes and questions"
                hint="One per line."
              >
                <Bullets items={content.strategy.openQuestions} dense />
              </EditableBlock>
            </div>
          )}
        </div>

        <div className="w-full md:w-[300px] flex flex-col gap-[18px]">
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
      {/* Sharing the quote is the point of the page, so publishing is a real
          CTA here rather than a faint link tucked next to the stamp. Once
          it's live the button is replaced in place by the link itself, since
          that's what you came back for, with unpublish demoted underneath. */}
      <div className="flex flex-wrap justify-start md:justify-end items-start gap-3">
        <Button variant="ghost" onClick={() => router.push("/quote")}>
          New quote
        </Button>
        <a href={`/api/briefs/${brief.id}/pdf?template=${brief.template || "classic"}`} download>
          <Button variant="outline" icon={Download}>
            Download PDF
          </Button>
        </a>
        {brief.status === "DRAFT" && (
          <Button variant="outline" icon={Check} disabled={working} onClick={handleAddToTrack}>
            Add to Track
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
                className="text-[13px] text-success font-semibold truncate hover:underline"
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
              className="text-[11.5px] text-text-muted hover:text-overdue underline bg-none border-none cursor-pointer p-0"
            >
              {publishing ? "Working..." : "Unpublish"}
            </button>
          </div>
        ) : (
          <Button icon={Link2} disabled={publishing} onClick={handleTogglePublish}>
            {publishing ? "Publishing..." : "Publish as a page"}
          </Button>
        )}
      </div>
    </>
  );
}
