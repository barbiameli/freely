"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Upload } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { ProjectCard, ProjectCardGrid } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import {
  createProjectFromDocumentAction,
  deleteProjectAction,
} from "@/actions/projects";
import { addBriefToTrackAction } from "@/actions/briefs";
import { ActionError } from "@/components/ui/action-error";
import { Confirm } from "@/components/ui/confirm";
import { deliverableProgress } from "@/lib/project-state";
import { extractFileText } from "@/lib/extract-file";
import { currencySymbol } from "@/lib/currencies";
import { useT } from "@/lib/i18n/context";
import { fill } from "@/lib/i18n";

interface TrackProject {
  id: string;
  title: string;
  client: string;
  status: string;
  price: number;
  hours: number;
  currency?: string | null;
  deliverables: { id: string; done: boolean }[];
}

/** A quote that exists and is not being tracked yet. */
export interface UntrackedQuote {
  id: string;
  title: string;
  client: string;
  price: number;
  currency: string | null;
}

export function TrackDashboard({
  projects,
  untracked,
}: {
  projects: TrackProject[];
  untracked: UntrackedQuote[];
}) {
  const router = useRouter();
  const t = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [uploadReading, setUploadReading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ id: string; title: string; client: string } | null>(null);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const visibleProjects = projects.filter((p) => !removedIds.includes(p.id));
  const activeCount = visibleProjects.filter((p) => p.status === "ACTIVE" || p.status === "DUE").length;
  const overdueCount = visibleProjects.filter((p) => p.status === "OVERDUE").length;
  const totalValue = visibleProjects.reduce((sum, p) => sum + p.price, 0);
  const totalDeliverables = visibleProjects.reduce((sum, p) => sum + p.deliverables.length, 0);
  const doneDeliverables = visibleProjects.reduce(
    (sum, p) => sum + p.deliverables.filter((d) => d.done).length,
    0
  );

  // The dialog holds which project it is asking about, so the card only has to
  // say "somebody pressed delete on me".
  async function handleDelete() {
    const target = asking;
    if (!target) return;
    const projectId = target.id;
    setAsking(null);
    setDeletingId(projectId);
    const result = await deleteProjectAction(projectId);
    setDeletingId(null);
    if (result.ok) {
      setRemovedIds((prev) => [...prev, projectId]);
      router.refresh();
    }
  }

  /**
   * Tracks an existing quote.
   *
   * This used to make a project out of a typed title and client name, which
   * produced an empty shell: no deliverables to tick, no timeline, no price, so
   * nothing to break down, nothing to show a client and nothing to invoice.
   * Every part of Track reads off a quote, so this picks one.
   */
  async function handleTrack(briefId: string) {
    setWorking(true);
    setError("");
    try {
      // The action redirects on success, and Next signals a redirect by
      // throwing, so that one is expected.
      await addBriefToTrackAction(briefId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("NEXT_REDIRECT")) setError(t.brief.addToTrackFailed);
      setWorking(false);
    }
  }

  async function handleUploadFile(file: File) {
    setUploadReading(true);
    setUploadError("");
    const extracted = await extractFileText(file);
    setUploadReading(false);
    if (!extracted.ok) {
      setUploadError(extracted.error);
      return;
    }
    setWorking(true);
    const result = await createProjectFromDocumentAction(extracted.text);
    setWorking(false);
    if (!result.ok) {
      setUploadError(result.error);
      return;
    }
    router.push(`/track/${result.data.projectId}`);
  }

  return (
    <>
      <Topbar />
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="font-display italic text-[32px] text-coral m-0">
            {t.track.everythingRunning}
          </h1>
          <p className="text-slate text-small mt-2">
            {visibleProjects.length === 1
              ? t.track.projectCountOne
              : fill(t.track.projectCount, { count: visibleProjects.length })}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            icon={Upload}
            onClick={() => setShowUpload((s) => !s)}
          >
            {t.track.uploadSow}
          </Button>
          <Button icon={Plus} onClick={() => setShowAdd((s) => !s)}>
            {t.track.addProject}
          </Button>
        </div>
      </div>
      {showUpload && (
        <Card className="flex flex-col gap-2.5">
          <div className="text-small text-slate">
            {t.track.uploadSowHint}
          </div>
          <label className="flex flex-col gap-2 cursor-pointer">
            <input
              type="file"
              accept=".txt,.md,.pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(file);
              }}
            />
            <span className="font-body font-bold text-small text-violet">
              {uploadReading ? "Reading file..." : working ? "Creating project..." : "+ Choose file"}
            </span>
          </label>
          {uploadError && <div className="text-overdue text-small">{uploadError}</div>}
        </Card>
      )}
      {visibleProjects.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-[14px]">
          {[
            [t.track.activeNow, String(activeCount)],
            [t.track.overdueCount, String(overdueCount)],
            [t.track.totalValue, `${currencySymbol(visibleProjects[0]?.currency)}${totalValue.toLocaleString()}`],
            [t.track.doneCount, `${doneDeliverables}/${totalDeliverables}`],
          ].map(([label, value]) => (
            <Card key={label} className="min-w-0 px-4 py-3.5 lg:px-5">
              <div className="font-label text-caption text-slate uppercase tracking-wide">{label}</div>
              <div className="font-body font-bold text-lg text-ink mt-0.5 truncate">{value}</div>
            </Card>
          ))}
        </div>
      )}
      {showAdd && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-body font-bold text-small text-ink">{t.track.addFromQuote}</div>
              <p className="text-meta text-text-muted mt-0.5 mb-0 text-pretty">
                {t.track.addFromQuoteHint}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              aria-label={t.common.close}
              className="shrink-0 text-text-muted hover:text-ink bg-none border-none cursor-pointer p-0 tap"
            >
              <X size={15} />
            </button>
          </div>

          {untracked.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-small text-slate">{t.track.noQuotesToTrack}</span>
              <Button size="sm" variant="outline" onClick={() => router.push("/quote")}>
                {t.track.makeAQuote}
              </Button>
            </div>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col">
              {untracked.map((q) => (
                <li key={q.id} className="border-b border-line/70 last:border-b-0">
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => handleTrack(q.id)}
                    className="w-full flex items-center justify-between gap-3 text-left bg-none border-none cursor-pointer px-0 py-2.5 tap-row hover:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block font-body font-semibold text-small text-ink truncate">
                        {q.title}
                      </span>
                      <span className="block text-caption text-text-muted truncate">
                        {q.client}
                      </span>
                    </span>
                    <span className="font-body font-semibold text-small text-slate shrink-0 tabular-nums">
                      {currencySymbol(q.currency)}
                      {q.price.toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ActionError error={error} />
        </Card>
      )}
      {error && <div className="text-overdue text-small">{error}</div>}
      {visibleProjects.length === 0 ? (
        <Card className="text-center text-slate p-10">
          {t.track.nothingTracked}
        </Card>
      ) : (
        <ProjectCardGrid>
          {visibleProjects.map((p) => {
            const progress = deliverableProgress(p.deliverables);
            const doneCount = p.deliverables.filter((d) => d.done).length;
            return (
              <ProjectCard
                key={p.id}
                href={`/track/${p.id}`}
                deleting={deletingId === p.id}
                deleteLabel={t.track.deleteProjectLabel}
                onDelete={() => setAsking({ id: p.id, title: p.title, client: p.client })}
                project={{
                  id: p.id,
                  title: p.title,
                  client: p.client,
                  status: p.status,
                  progress,
                  meta: `${currencySymbol(p.currency)}${p.price.toLocaleString()} · ${p.hours}h · ${doneCount}/${p.deliverables.length}`,
                }}
              />
            );
          })}
        </ProjectCardGrid>
      )}

      <Confirm
        open={asking !== null}
        onClose={() => setAsking(null)}
        onConfirm={handleDelete}
        working={deletingId !== null}
        title={t.common.confirmDeleteProject}
        hint={t.common.confirmDeleteProjectHint}
        confirmLabel={t.common.confirmDeleteProjectAction}
      >
        <p className="text-small text-ink m-0 font-semibold text-pretty">{asking?.title}</p>
        <p className="text-caption text-text-muted mt-1 mb-0">{asking?.client}</p>
      </Confirm>
    </>
  );
}
