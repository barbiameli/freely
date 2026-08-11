"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Upload } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { ProjectCard, ProjectCardGrid } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  createManualProjectAction,
  createProjectFromDocumentAction,
  deleteProjectAction,
} from "@/actions/projects";
import { deliverableProgress } from "@/lib/project-state";
import { extractFileText } from "@/lib/extract-file";
import { currencySymbol } from "@/lib/currencies";
import { useT } from "@/lib/i18n/context";

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

export function TrackDashboard({ projects }: { projects: TrackProject[] }) {
  const router = useRouter();
  const t = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [uploadReading, setUploadReading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  async function handleDelete(e: React.MouseEvent, projectId: string, projectTitle: string) {
    e.stopPropagation();
    if (
      !window.confirm(
        `Delete "${projectTitle}"? This removes its deliverables and diary entries too, this can't be undone.`
      )
    ) {
      return;
    }
    setDeletingId(projectId);
    const result = await deleteProjectAction(projectId);
    setDeletingId(null);
    if (result.ok) {
      setRemovedIds((prev) => [...prev, projectId]);
      router.refresh();
    }
  }

  async function handleAdd() {
    setWorking(true);
    setError("");
    const result = await createManualProjectAction(title, client);
    setWorking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/track/${result.data.projectId}`);
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
      <Topbar eyebrow="Track - Projects" />
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="font-display italic text-[32px] text-coral m-0">
            Everything you&apos;re running right now.
          </h1>
          <p className="text-slate text-small mt-2">
            {visibleProjects.length} project{visibleProjects.length === 1 ? "" : "s"} · from accepted
            quotes or added directly.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button
            variant="outline"
            icon={Upload}
            onClick={() => setShowUpload((s) => !s)}
          >
            Upload a brief / SOW
          </Button>
          <Button icon={Plus} onClick={() => setShowAdd((s) => !s)}>
            Add project
          </Button>
        </div>
      </div>
      {showUpload && (
        <Card className="flex flex-col gap-2.5">
          <div className="text-small text-slate">
            Drop a brief, SOW, or contract, Freely reads it and creates the project with
            deliverables and timeline already filled in.
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
        <div className="flex gap-[14px]">
          {[
            ["Active now", String(activeCount)],
            ["Overdue", String(overdueCount)],
            ["Total value", `${currencySymbol(visibleProjects[0]?.currency)}${totalValue.toLocaleString()}`],
            ["Deliverables done", `${doneDeliverables}/${totalDeliverables}`],
          ].map(([label, value]) => (
            <Card key={label} className="flex-1 px-5 py-3.5">
              <div className="font-label text-caption text-slate uppercase tracking-wide">{label}</div>
              <div className="font-body font-bold text-lg text-ink mt-0.5">{value}</div>
            </Card>
          ))}
        </div>
      )}
      {showAdd && (
        <Card className="flex gap-2.5 items-center">
          <TextField value={title} onChange={setTitle} placeholder={t.track.projectTitle} />
          <TextField value={client} onChange={setClient} placeholder={t.track.clientName} />
          <Button disabled={working} onClick={handleAdd}>
            Add
          </Button>
          <Button variant="ghost" onClick={() => setShowAdd(false)}>
            <X size={14} />
          </Button>
        </Card>
      )}
      {error && <div className="text-overdue text-small">{error}</div>}
      {visibleProjects.length === 0 ? (
        <Card className="text-center text-slate p-10">
          Nothing tracked yet. Generate a quote and add it to Track, or add a project directly.
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
                onDelete={() => handleDelete(
                  { stopPropagation: () => {} } as React.MouseEvent,
                  p.id,
                  p.title
                )}
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
    </>
  );
}
