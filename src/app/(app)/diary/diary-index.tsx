"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { ProjectCard, ProjectCardGrid, type ProjectCardData } from "@/components/project-card";
import { useT } from "@/lib/i18n/context";
import { fill } from "@/lib/i18n";

export interface DiaryProjectRow extends ProjectCardData {
  finished: boolean;
  published: boolean;
  entryCount: number;
}

type Tab = "current" | "past";

/**
 * Every project you could be reporting on.
 *
 * The diary used to redirect straight to whichever project was newest, so there
 * was no way to see the list at all and no sense of how many clients were
 * waiting on an update. Finished work sat in the same undifferentiated row as
 * live work, which is the wrong shape: nobody writes an update for a project
 * that ended in March.
 *
 * Same cards as Track, because they are the same projects.
 */
export function DiaryIndex({ projects }: { projects: DiaryProjectRow[] }) {
  const t = useT();
  const current = projects.filter((p) => !p.finished);
  const past = projects.filter((p) => p.finished);
  const [tab, setTab] = useState<Tab>(current.length > 0 ? "current" : "past");

  const shown = tab === "current" ? current : past;

  return (
    <>
      <div>
        <h1 className="font-display italic text-[30px] md:text-4xl text-coral m-0">
          {t.diary.heading}
        </h1>
        <p className="text-slate text-lead mt-2">{t.diary.subtitle}</p>
      </div>

      <Tabs
        label={t.nav.diary}
        value={tab}
        onChange={setTab}
        items={[
          { id: "current", label: t.diary.activeProjects, badge: current.length },
          { id: "past", label: t.diary.pastProjects, badge: past.length },
        ]}
      />

      {shown.length === 0 ? (
        <Card>
          <div className="text-slate text-body">{t.diary.noProjects}</div>
        </Card>
      ) : (
        <ProjectCardGrid>
          {shown.map((project) => (
            <ProjectCard key={project.id} project={project} href={`/diary/${project.id}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption text-text-muted">
                  {fill(t.diary.entryCount, { count: project.entryCount })}
                </span>
                {project.published && (
                  <span className="text-caption font-semibold text-success">
                    {t.diary.published}
                  </span>
                )}
              </div>
            </ProjectCard>
          ))}
        </ProjectCardGrid>
      )}
    </>
  );
}
