"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Send, Trash2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  updateProjectAction,
  toggleDeliverableAction,
  addDeliverableAction,
  sendToDiaryAction,
  deleteProjectAction,
  type ProjectStatusValue,
} from "@/actions/projects";
import { currencySymbol } from "@/lib/currencies";

interface Project {
  id: string;
  title: string;
  client: string;
  status: ProjectStatusValue;
  price: number;
  hours: number;
  hoursLogged: number;
  timeline: string;
  currency?: string | null;
  deliverables: { id: string; name: string; done: boolean }[];
}

interface ProjectSummary {
  id: string;
  title: string;
  client: string;
  status: ProjectStatusValue;
}

const STATUSES: ProjectStatusValue[] = ["ACTIVE", "DUE", "OVERDUE", "DONE"];
const STATUS_DOT: Record<ProjectStatusValue, string> = {
  ACTIVE: "bg-violet",
  DUE: "bg-coral",
  OVERDUE: "bg-overdue",
  DONE: "bg-success",
};

export function ProjectDetail({
  project,
  projectList,
}: {
  project: Project;
  projectList: ProjectSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [price, setPrice] = useState(String(project.price));
  const [hours, setHours] = useState(String(project.hours));
  const [hoursLogged, setHoursLogged] = useState(String(project.hoursLogged));
  const [timeline, setTimeline] = useState(project.timeline);
  const [newDeliverable, setNewDeliverable] = useState("");
  const [deleting, setDeleting] = useState(false);

  function commit(patch: Parameters<typeof updateProjectAction>[1]) {
    startTransition(async () => {
      await updateProjectAction(project.id, patch);
      router.refresh();
    });
  }

  async function handleDeleteProject() {
    if (
      !window.confirm(
        `Delete "${project.title}"? This removes its deliverables and diary entries too, this can't be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    const result = await deleteProjectAction(project.id);
    if (!result.ok) {
      setDeleting(false);
      return;
    }
    router.push("/track");
  }

  const doneCount = project.deliverables.filter((d) => d.done).length;

  return (
    <div className="flex gap-6 flex-1 min-h-0">
      <Card className="w-[220px] flex-shrink-0 overflow-y-auto">
        <Label>All projects</Label>
        <div className="flex flex-col gap-1 mt-1">
          {projectList.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/track/${p.id}`)}
              className={`flex items-center gap-2 text-left px-2.5 py-2 rounded-lg cursor-pointer border-none ${
                p.id === project.id ? "bg-violet-tint" : "bg-transparent hover:bg-paper"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[p.status]}`} />
              <span
                className={`text-[12.5px] truncate ${
                  p.id === project.id ? "font-bold text-violet" : "font-medium text-slate"
                }`}
              >
                {p.title}
              </span>
            </button>
          ))}
        </div>
      </Card>
      <div className="flex flex-col gap-7 flex-1 min-w-0">
      <Topbar eyebrow={`Track - ${project.title}`} />
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-display italic text-[30px] text-coral m-0">{project.title}</h1>
          <p className="text-slate text-[13px] mt-1.5">{project.client}</p>
        </div>
        <div className="flex gap-2.5">
          <Button
            variant="ghost"
            icon={Send}
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await sendToDiaryAction(project.id);
                router.push(`/diary/${project.id}`);
              })
            }
          >
            Send to Diary
          </Button>
          <Button onClick={() => router.push(`/track/${project.id}/invoice`)}>
            Generate invoice, {currencySymbol(project.currency)}
            {project.price.toLocaleString()}
          </Button>
          <Button
            variant="ghost"
            icon={Trash2}
            disabled={deleting}
            onClick={handleDeleteProject}
            className="text-overdue border-overdue/30 hover:text-overdue"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
      <div className="flex gap-[18px]">
        {[
          ["Deliverables", `${doneCount} of ${project.deliverables.length} done`],
          ["Price", `${currencySymbol(project.currency)}${project.price.toLocaleString()}`],
          ["Hours", `${project.hoursLogged} of ${project.hours} logged`],
        ].map(([l, v]) => (
          <Card key={l} className="flex-1 px-5 py-4">
            <Label>{l}</Label>
            <div className="font-body font-bold text-base text-ink">{v}</div>
          </Card>
        ))}
      </div>
      <div className="flex gap-5 flex-1 min-h-0">
        <Card className="flex-1 overflow-y-auto">
          <Label>Deliverables</Label>
          {project.deliverables.length === 0 && (
            <div className="text-text-muted text-[13px]">No deliverables listed.</div>
          )}
          {project.deliverables.map((d) => (
            <div
              key={d.id}
              onClick={() =>
                startTransition(async () => {
                  await toggleDeliverableAction(project.id, d.id);
                  router.refresh();
                })
              }
              className="flex items-center gap-2.5 py-2 cursor-pointer"
            >
              <div
                className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0 ${
                  d.done ? "bg-violet" : "border border-line"
                }`}
              >
                {d.done && <Check size={11} className="text-white" />}
              </div>
              <span className={`text-[13.5px] ${d.done ? "text-text-muted" : "text-ink"}`}>
                {d.name}
              </span>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <TextField
              value={newDeliverable}
              onChange={setNewDeliverable}
              placeholder="Add a deliverable..."
            />
            <Button
              disabled={!newDeliverable.trim() || isPending}
              onClick={() =>
                startTransition(async () => {
                  await addDeliverableAction(project.id, newDeliverable);
                  setNewDeliverable("");
                  router.refresh();
                })
              }
            >
              Add
            </Button>
          </div>
        </Card>
        <Card className="w-[300px]">
          <Label>Edit details</Label>
          <div className="flex flex-col gap-2.5">
            <Field label="Price ($)">
              <TextField value={price} onChange={setPrice} />
            </Field>
            <Field label="Hours budgeted">
              <TextField value={hours} onChange={setHours} />
            </Field>
            <Field label="Hours logged">
              <TextField value={hoursLogged} onChange={setHoursLogged} />
            </Field>
            <Field label="Timeline">
              <TextField value={timeline} onChange={setTimeline} />
            </Field>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() =>
                commit({
                  price: Number(price) || 0,
                  hours: Number(hours) || 0,
                  hoursLogged: Number(hoursLogged) || 0,
                  timeline,
                })
              }
              className="justify-center"
            >
              Save changes
            </Button>
            <div>
              <div className="text-[11px] text-text-muted mb-1">Status</div>
              <div className="flex gap-1.5 flex-wrap">
                {STATUSES.map((s) => (
                  <Chip key={s} active={project.status === s} onClick={() => commit({ status: s })}>
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-text-muted mb-1">{label}</div>
      {children}
    </div>
  );
}
