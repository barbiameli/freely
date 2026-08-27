"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";
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
import { Popover, PopoverHeader, PopoverList } from "@/components/ui/popover";
import { deliverableProgress } from "@/lib/project-state";
import { extractFileText } from "@/lib/extract-file";
import { currencySymbol } from "@/lib/currencies";
import { useT } from "@/lib/i18n/context";
import { fill } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";

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
      <PageHeader
        title={t.track.everythingRunning}
        subtitle={
          visibleProjects.length === 1
            ? t.track.projectCountOne
            : fill(t.track.projectCount, { count: visibleProjects.length })
        }
        /* Both panels hang off their own button. They used to render further
           down the page, after the stat cards, so what you had just summoned
           appeared half a screen away and read as a section that had always
           been there. */
        action={
          <>
          <Popover
            label={t.track.uploadSow}
            align="right"
            trigger={({ open, toggle }) => (
              <Button variant="outline" icon={Upload} onClick={toggle} aria-expanded={open}>
                {t.track.uploadSow}
              </Button>
            )}
          >
            {() => (
              <>
                <PopoverHeader title={t.track.uploadSow} hint={t.track.uploadSowHint} />
                <div className="px-4 py-3.5">
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
                      {uploadReading
                        ? t.track.readingFile
                        : working
                          ? t.track.creatingProject
                          : t.track.chooseFile}
                    </span>
                  </label>
                  <ActionError error={uploadError} className="mt-2" />
                </div>
              </>
            )}
          </Popover>

          <Popover
            label={t.track.addFromQuote}
            align="right"
            trigger={({ open, toggle }) => (
              <Button icon={Plus} onClick={toggle} aria-expanded={open}>
                {t.track.addProject}
              </Button>
            )}
          >
            {({ close }) => (
              <>
                <PopoverHeader title={t.track.addFromQuote} hint={t.track.addFromQuoteHint} />
                {untracked.length === 0 ? (
                  <div className="px-4 py-4">
                    <p className="text-small text-slate m-0">{t.track.noQuotesToTrack}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => router.push("/quote")}
                    >
                      {t.track.makeAQuote}
                    </Button>
                  </div>
                ) : (
                  <PopoverList>
                    {untracked.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        disabled={working}
                        onClick={() => {
                          close();
                          handleTrack(q.id);
                        }}
                        className="w-full flex items-center justify-between gap-3 text-left bg-none border-none cursor-pointer px-4 py-2.5 border-b border-line/70 last:border-b-0 hover:bg-paper transition-colors disabled:opacity-50 tap-row"
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
                    ))}
                  </PopoverList>
                )}
                <ActionError error={error} className="px-4 pb-3" />
              </>
            )}
          </Popover>
          </>
        }
      />
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
