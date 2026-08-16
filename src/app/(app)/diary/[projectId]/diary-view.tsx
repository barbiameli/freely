"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Copy, Check as CheckIcon, ExternalLink, Globe } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import { StatRow } from "@/components/track/stat-row";
import { DeliverableItem, type DeliverableView } from "@/components/track/deliverable-item";
import { Pencil, Trash2 } from "lucide-react";
import { RegisterToggle } from "@/components/diary/register-toggle";
import { useAction } from "@/lib/use-action";
import {
  addDiaryEntryAction,
  updateDiaryEntryAction,
  deleteDiaryEntryAction,
  setPublishedAction,
} from "@/actions/diary";
import { statusLabel, STATUS_TEXT } from "@/lib/project-status";
import { formatDay } from "@/lib/schedule";
import { UpdateBody } from "@/components/update-body";
import { useT, useLocale } from "@/lib/i18n/context";
import { fill } from "@/lib/i18n";

interface Entry {
  id: string;
  date: string;
  title: string;
  body: string;
}

interface Project {
  id: string;
  title: string;
  client: string;
  status: string;
  published: boolean;
  publicSlug: string;
  deliverables: DeliverableView[];
  /** Which register the client's page is written in. */
  plainLanguage?: boolean;
  diaryEntries: Entry[];
}

/**
 * The diary for one project.
 *
 * Rebuilt around two things it was missing. The client's page was a fake
 * browser mockup in a sidebar, which showed a rough impression of the real page
 * while burying the actual link: the thing you came here to do was the hardest
 * thing to find. It is a panel at the top now, saying plainly whether the client
 * can see anything, with the link and a way to open the real page.
 *
 * And the deliverables were a read-only list of names. They are the same
 * component Track uses now, so the steps, dates, progress and editing are all
 * here, and a tick in either place is a tick in both. There is no reason to make
 * someone leave the diary to mark off the work they are writing an update about.
 */
export function DiaryView({
  project,
  allProjects,
  /** The Your work / What the client sees strip, placed in the title row. */
  tabs,
}: {
  project: Project;
  allProjects: { id: string; title: string; status: string }[];
  tabs?: ReactNode;
}) {
  const router = useRouter();
  const t = useT();
  const { run, pending, error } = useAction();
  const [newEntry, setNewEntry] = useState("");
  const [copied, setCopied] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/p/${project.publicSlug}`
      : `/p/${project.publicSlug}`;

  const doneCount = project.deliverables.filter((d) => d.done).length;
  const total = project.deliverables.length;

  // Everything that is about the client, without the page chrome around it.
  const body = (
    <>
      {/* The client's page, first rather than tucked in a sidebar: publishing
          is the point of this screen, and whether the client can see anything
          is the one fact worth stating outright. */}
      <Card className={project.published ? "border-violet border-[1.5px]" : undefined}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Globe size={14} className={project.published ? "text-violet" : "text-text-muted"} />
              <Label>{t.diary.publicLink}</Label>
            </div>
            <p className="text-caption text-text-muted mt-1 mb-0">
              {project.published ? t.diary.liveNow : t.diary.notPublishedYet}
            </p>
          </div>
          <Button
            variant={project.published ? "outline" : undefined}
            disabled={pending}
            onClick={() => run(() => setPublishedAction(project.id, !project.published))}
          >
            {pending
              ? t.common.working
              : project.published
              ? t.diary.unpublish
              : t.diary.publish}
          </Button>
        </div>

        {project.published && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line">
            <span className="text-small text-slate truncate flex-1 font-mono">{publicUrl}</span>
            <button
              type="button"
              title={t.diary.copyLink}
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center gap-1.5 text-caption font-semibold text-violet bg-none border-none cursor-pointer p-0 tap shrink-0"
            >
              {copied ? <CheckIcon size={13} /> : <Copy size={13} />}
              {copied ? t.diary.linkCopied : t.diary.copyLink}
            </button>
            <Link
              href={`/p/${project.publicSlug}`}
              target="_blank"
              className="flex items-center gap-1.5 text-caption font-semibold text-violet no-underline shrink-0"
            >
              <ExternalLink size={13} />
              {t.diary.openPage}
            </Link>
          </div>
        )}
      </Card>

      <StatRow
        stats={[
          { label: t.track.done, value: total > 0 ? `${Math.round((doneCount / total) * 100)}%` : "0%" },
          { label: t.track.deliverables, value: `${doneCount}/${total}` },
          { label: t.diary.entries, value: String(project.diaryEntries.length) },
        ]}
      />

      <div className="flex flex-col lg:flex-row gap-5">
        <Card className="flex-1 min-w-0">
          <Label>{t.diary.entries}</Label>
          <p className="text-caption text-text-muted mt-1 mb-3">{t.diary.writeUpdate}</p>

          {/* Here, above the entries, rather than at the foot of the tracker
              card on the right. It changes what the client reads, so it
              belongs with the other thing that changes what the client reads.
              Down there it was found by accident, if at all. */}
          <RegisterToggle
            projectId={project.id}
            plainLanguage={project.plainLanguage ?? false}
            lines={project.deliverables.map((d) => ({
              id: d.id,
              name: d.name,
              clientName: d.clientName ?? null,
              done: d.done,
            }))}
            publicSlug={project.publicSlug}
            published={project.published}
          />

          <div className="flex flex-col gap-2">
            <textarea
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              rows={3}
              placeholder={t.diary.writeUpdate}
              className="w-full font-body text-small text-ink leading-relaxed bg-paper border border-line rounded-lg px-3 py-2.5 outline-none focus:border-violet"
            />
            <div className="flex justify-end">
              <Button
                icon={Plus}
                disabled={!newEntry.trim() || pending}
                onClick={() => {
                  const value = newEntry;
                  setNewEntry("");
                  void run(() => addDiaryEntryAction(project.id, t.diary.entryTitle, value));
                }}
              >
                {pending ? t.common.working : t.diary.addEntry}
              </Button>
            </div>
          </div>

          <ActionError error={error} className="mt-2" />

          <div className="flex flex-col mt-4">
            {project.diaryEntries.length === 0 ? (
              <p className="text-small text-text-muted m-0">{t.diary.noEntries}</p>
            ) : (
              project.diaryEntries.map((entry, i) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  first={i === 0}
                  last={i === project.diaryEntries.length - 1}
                />
              ))
            )}
          </div>
        </Card>

        {/* The tracker's deliverables, not a copy of them. Same component, so
            the steps, dates and editing come with it. */}
        <Card className="w-full lg:w-[380px] lg:shrink-0">
          <Label>{t.diary.fromTracker}</Label>
          <p className="text-caption text-text-muted mt-1 mb-2">{t.diary.fromTrackerHint}</p>
          {total === 0 ? (
            <p className="text-small text-text-muted m-0">{t.track.nothingDated}</p>
          ) : (
            <div className="flex flex-col">
              {project.deliverables.map((d) => (
                <DeliverableItem
                  key={d.id}
                  deliverable={d}
                  projectId={project.id}
                  expanded={openId === d.id}
                  onToggleExpanded={() => setOpenId(openId === d.id ? null : d.id)}
                />
              ))}
            </div>
          )}
          <Link
            href={`/track/${project.id}`}
            className="inline-block text-caption font-semibold text-violet no-underline mt-3"
          >
            {fill(t.diary.openInTracker, { name: t.nav.track })}
          </Link>
        </Card>
      </div>
    </>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 flex-1 min-h-0">
      <Card className="w-full lg:w-[172px] lg:shrink-0 lg:overflow-y-auto px-3.5 py-4">
        <Label>{t.track.allProjects}</Label>
        <div className="flex flex-col gap-1 mt-1">
          {allProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/track/${p.id}?view=client`)}
              className={`flex items-center gap-2 text-left px-2.5 py-2 rounded-lg cursor-pointer border-none ${
                p.id === project.id ? "bg-violet-tint" : "bg-transparent hover:bg-paper"
              }`}
            >
              <span
                className={`text-small truncate ${
                  p.id === project.id ? "font-bold text-violet" : "font-medium text-slate"
                }`}
              >
                {p.title}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-5 md:gap-6 flex-1 min-w-0">
        <Topbar />

        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
          <div className="min-w-0">
            <h1 className="font-display italic text-[28px] md:text-[30px] text-coral m-0">
              {project.title}
            </h1>
            <p className="text-slate text-small mt-1.5">
              {project.client} ·{" "}
              <span className={STATUS_TEXT[project.status]}>
                {statusLabel(project.status, t)}
              </span>
            </p>
          </div>
          {tabs}
        </div>

        {body}
      </div>
    </div>
  );
}

/**
 * One entry, editable and removable.
 *
 * Both were missing, and everything that can go wrong here goes wrong in
 * public: a double-submitted update, a line written in tracker shorthand, an
 * update that went to the wrong project. Without these the only fix was to
 * unpublish the whole page.
 *
 * Editing in place rather than in a dialog, because the thing being corrected is
 * usually one word and a dialog is four interactions to change one word.
 *
 * Delete asks once. It is on the client's page, so it is not a keystroke away,
 * and it is also not a modal: the second click is the confirmation.
 */
function EntryRow({
  entry,
  first,
  last,
}: {
  entry: { id: string; body: string; date: string };
  first: boolean;
  last: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const { run, pending, error } = useAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.body);
  const [confirming, setConfirming] = useState(false);

  async function save() {
    const value = draft.trim();
    if (!value || value === entry.body) {
      setEditing(false);
      return;
    }
    setEditing(false);
    await run(() => updateDiaryEntryAction(entry.id, { body: value }));
  }

  return (
    <div className={`flex gap-3 py-3 group ${last ? "" : "border-b border-line"}`}>
      <div className="flex flex-col items-center shrink-0 pt-1.5">
        <span className={`w-2 h-2 rounded-full ${first ? "bg-violet" : "bg-line"}`} />
        {!last && <span className="w-px flex-1 bg-line mt-1.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="text-caption text-text-muted">
            {formatDay(new Date(entry.date), locale)}
          </div>
          {/* Visible on hover on a mouse, always visible on touch, since there
              is no hover to reveal them with. */}
          <div className="flex items-center gap-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setDraft(entry.body);
                  setEditing(true);
                }}
                className="flex items-center gap-1 text-caption text-slate hover:text-violet bg-none border-none cursor-pointer p-0 tap"
              >
                <Pencil size={11} /> {t.common.edit}
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                void run(() => deleteDiaryEntryAction(entry.id));
              }}
              onBlur={() => setConfirming(false)}
              className={`flex items-center gap-1 text-caption bg-none border-none cursor-pointer p-0 tap ${
                confirming ? "text-overdue font-semibold" : "text-slate hover:text-overdue"
              }`}
            >
              <Trash2 size={11} /> {confirming ? t.diary.deleteConfirm : t.common.delete}
            </button>
          </div>
        </div>

        {editing ? (
          <div className="mt-1.5">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
              }}
              rows={Math.min(12, Math.max(3, draft.split("\n").length + 1))}
              className="w-full font-body text-small text-ink leading-[1.6] bg-white border border-violet rounded-lg px-3 py-2.5 outline-none"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="font-body font-bold text-meta text-white bg-violet rounded-lg px-3.5 py-1.5 border-none cursor-pointer disabled:opacity-50"
              >
                {pending ? t.common.saving : t.common.save}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-meta text-text-muted bg-none border-none cursor-pointer p-0 tap"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        ) : (
          /* The same component the client's page uses, so what you write here
             and what they read are formatted once. */
          <div className="mt-1">
            <UpdateBody text={entry.body} />
          </div>
        )}

        <ActionError error={error} className="mt-2" />
      </div>
    </div>
  );
}
