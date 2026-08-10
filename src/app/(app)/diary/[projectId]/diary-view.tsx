"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "@/lib/use-action";
import { Plus, Copy, Check as CheckIcon, Trash2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { ActionError } from "@/components/ui/action-error";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { addDiaryEntryAction, setPublishedAction } from "@/actions/diary";
import { deleteProjectAction } from "@/actions/projects";
import { useT } from "@/lib/i18n/context";

interface Entry {
  id: string;
  date: string;
  title: string;
  body: string;
}

interface Project {
  id: string;
  title: string;
  status: "ACTIVE" | "DUE" | "OVERDUE" | "DONE";
  timeline: string;
  published: boolean;
  publicSlug: string;
  deliverables: { id: string; name: string; done: boolean }[];
  diaryEntries: Entry[];
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-violet",
  DUE: "text-coral",
  OVERDUE: "text-overdue",
  DONE: "text-success",
};

export function DiaryView({
  project,
  allProjects,
}: {
  project: Project;
  allProjects: { id: string; title: string }[];
}) {
  const router = useRouter();
  const t = useT();
  const { run, pending: isPending, error } = useAction();
  const [newEntry, setNewEntry] = useState("");
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/p/${project.publicSlug}`
      : `/p/${project.publicSlug}`;

  async function handleDeleteProject(e: React.MouseEvent, projectId: string, projectTitle: string) {
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
    if (!result.ok) return;
    if (projectId === project.id) {
      router.push("/diary");
    } else {
      router.refresh();
    }
  }

  return (
    <>
      <Topbar eyebrow="Diary" />
      <div>
        <h1 className="font-display italic text-[32px] text-coral m-0">
          Client updates, written for you.
        </h1>
        <p className="text-slate text-small mt-2">
          Auto-generated from your project tracker, edit anything before it goes out.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {allProjects.map((p) => {
          const active = p.id === project.id;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-1 rounded-full pl-3.5 pr-1.5 py-1 ${
                active ? "bg-violet text-white" : "bg-paper text-slate border border-line"
              }`}
            >
              <button
                type="button"
                onClick={() => router.push(`/diary/${p.id}`)}
                className="font-body font-medium text-xs bg-none border-none cursor-pointer p-0"
              >
                {p.title}
              </button>
              <button
                type="button"
                aria-label={`Delete ${p.title}`}
                disabled={deletingId === p.id}
                onClick={(e) => handleDeleteProject(e, p.id, p.title)}
                className={`flex items-center justify-center rounded-full p-1 border-none cursor-pointer ${
                  active ? "text-white/70 hover:text-white hover:bg-white/15" : "text-slate hover:text-overdue hover:bg-line"
                }`}
              >
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col md:flex-row gap-5 flex-1 min-h-0">
        <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto">
          <div className="flex justify-between items-center">
            <Label>{t.diary.entries}</Label>
            <div className="flex-1 mx-3">
              <TextField value={newEntry} onChange={setNewEntry} placeholder={t.diary.writeUpdate} />
            </div>
            <Button
              variant="ghost"
              icon={Plus}
              disabled={!newEntry.trim() || isPending}
              onClick={() => {
                const value = newEntry;
                setNewEntry("");
                void run(() => addDiaryEntryAction(project.id, "New update", value));
              }}
            >
              {t.diary.addEntry}
            </Button>
          </div>
          <ActionError error={error} />
          {project.diaryEntries.map((e) => (
            <Card key={e.id}>
              <div className="flex gap-2.5 items-center mb-1.5">
                <span className="font-body font-semibold text-caption text-text-muted">
                  {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span className="font-body font-bold text-sm text-ink">{e.title}</span>
              </div>
              <p className="text-small text-slate m-0 leading-relaxed">{e.body}</p>
            </Card>
          ))}
          {project.diaryEntries.length === 0 && (
            <div className="text-text-muted text-small">{t.diary.noEntries}</div>
          )}
        </div>
        <div className="w-full md:w-[340px]">
          <div className="flex justify-between items-center mb-3">
            <Label>{t.diary.clientSite}</Label>
            <Button
              disabled={isPending}
              onClick={() => run(() => setPublishedAction(project.id, !project.published))}
            >
              {project.published ? t.diary.published : t.diary.publish}
            </Button>
          </div>
          {project.published && (
            <div className="flex items-center gap-2 mb-3 bg-paper rounded-lg px-3 py-2">
              <span className="text-xs text-slate truncate flex-1">{publicUrl}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-violet"
                title="Copy link"
              >
                {copied ? <CheckIcon size={14} /> : <Copy size={14} />}
              </button>
            </div>
          )}
          <Card className="p-0 overflow-hidden">
            <div className="bg-paper px-3.5 py-2.5 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-line" />
              ))}
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="font-display italic text-lg text-coral">{project.title}</div>
              {project.status === "DONE" ? (
                <div className="bg-mint-solid rounded-md px-3 py-2 font-label text-small text-success">
                  Milestone sign-off received
                </div>
              ) : (
                <div className={`font-body font-semibold text-xs ${STATUS_COLOR[project.status]}`}>
                  Status: {project.status}
                  {project.timeline ? ` · ${project.timeline}` : ""}
                </div>
              )}
              <Label>{t.diary.latestUpdate}</Label>
              <p className="text-small text-slate m-0">
                {project.diaryEntries[0]?.body || "No updates yet."}
              </p>
              <Label>{t.track.deliverables}</Label>
              {project.deliverables.map((d) => (
                <div key={d.id} className={`text-small ${d.done ? "text-success" : "text-slate"}`}>
                  {d.done ? "✓" : "○"} {d.name}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
