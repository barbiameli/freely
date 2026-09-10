"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { addDiaryEntryAction } from "@/actions/diary";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/page-header";
import { useAction } from "@/lib/use-action";
import { useT } from "@/lib/i18n/context";
import { formatLongDay } from "@/lib/schedule";
import { useLocale } from "@/lib/i18n/context";

export interface UpdateEntry {
  id: string;
  body: string;
  createdAt: string;
}

export interface UpdatableProject {
  id: string;
  title: string;
  published: boolean;
  entries: UpdateEntry[];
}

/**
 * What you tell the client, per project, from the client's own page.
 *
 * This lived behind a "What the client sees" tab on each project, which meant
 * that writing an update to somebody you have three jobs with was three tabs
 * on three pages. The client is who you are writing to, so the writing belongs
 * where the client is.
 *
 * One project open at a time. A client with six projects and six open
 * composers is six textareas nobody is going to fill in, and the one you want
 * is nearly always the one you touched last.
 */
export function UpdatesPanel({
  projects,
  bare,
}: {
  projects: UpdatableProject[];
  /** Inside the setup dialog, which brings its own heading and card. */
  bare?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const { run, pending, error } = useAction();
  // The most recent, which is the one being worked on.
  const [openId, setOpenId] = useState<string | null>(projects[0]?.id ?? null);
  const [draft, setDraft] = useState("");

  if (projects.length === 0) return null;

  const rows = (
    <>
        {projects.map((project) => {
          const open = openId === project.id;
          return (
            <div key={project.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  setOpenId(open ? null : project.id);
                  setDraft("");
                }}
                aria-expanded={open}
                className="w-full flex items-center gap-3 py-3 bg-none border-none cursor-pointer text-left tap-row"
              >
                <ChevronDown
                  size={14}
                  className={`text-text-muted shrink-0 transition-transform ${
                    open ? "" : "-rotate-90"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-body font-semibold text-small text-ink truncate">
                    {project.title}
                  </span>
                  <span className="block text-caption text-text-muted">
                    {project.entries.length === 0
                      ? t.diary.noEntries
                      : t.updates.count.replace("{n}", String(project.entries.length))}
                  </span>
                </span>
                {/* Said here because an update written against an unpublished
                    project is an update nobody can read. */}
                {!project.published && (
                  <span className="shrink-0 font-label text-caption text-amber">
                    {t.updates.notShared}
                  </span>
                )}
              </button>

              {open && (
                <div className="pb-4 pl-7">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder={t.diary.writeUpdate}
                    aria-label={t.diary.writeUpdate}
                    className="w-full font-body text-small text-ink leading-relaxed bg-paper border border-line rounded-sm px-3 py-2.5 outline-none focus:border-violet resize-y"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      icon={Plus}
                      disabled={!draft.trim() || pending}
                      onClick={() => {
                        const value = draft;
                        setDraft("");
                        void run(() =>
                          addDiaryEntryAction(project.id, t.diary.entryTitle, value)
                        );
                      }}
                    >
                      {pending ? t.common.working : t.diary.addEntry}
                    </Button>
                  </div>

                  {project.entries.length > 0 && (
                    <ul className="list-none p-0 m-0 mt-3 flex flex-col gap-2.5">
                      {project.entries.map((entry) => (
                        <li key={entry.id}>
                          <div className="font-label text-caption text-text-muted">
                            {formatLongDay(new Date(entry.createdAt), locale)}
                          </div>
                          <p className="text-small text-slate leading-relaxed m-0 whitespace-pre-line">
                            {entry.body}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Link
                    href={`/track/${project.id}`}
                    className="inline-block text-caption font-semibold text-link no-underline mt-3"
                  >
                    {t.updates.openProject}
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      <ActionError error={error} className="mt-2" />
    </>
  );

  if (bare) return <div className="flex flex-col">{rows}</div>;
  return (
    <>
      <SectionHeading title={t.diary.entries} hint={t.updates.hint} />
      <Card className="flex flex-col">{rows}</Card>
    </>
  );
}
