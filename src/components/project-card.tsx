"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { STATUS_FILL, STATUS_TEXT, statusLabel } from "@/lib/project-status";
import { useT } from "@/lib/i18n/context";

export interface ProjectCardData {
  id: string;
  title: string;
  client: string;
  status: string;
  /** 0 to 1. */
  progress: number;
  /** The line under the client: price, hours, count, whatever the screen needs. */
  meta: string;
}

/**
 * One project, as a card.
 *
 * Extracted because the same card now appears in three places: the Track
 * dashboard, the invoice queue and the diary. It had been copied twice, which
 * is how the three drifted apart in the first place, and a project should not
 * change shape depending on which screen you found it on.
 *
 * The card navigates on click rather than wrapping everything in a link,
 * because it contains its own buttons and a link around a button is a mess to
 * get right. Anything passed as children sits at the foot, inside a wrapper
 * that stops clicks reaching the card.
 */
export function ProjectCard({
  project,
  href,
  onDelete,
  deleting,
  deleteLabel,
  highlight,
  children,
}: {
  project: ProjectCardData;
  href: string;
  /** Omit to leave the card without a delete affordance. */
  onDelete?: () => void;
  deleting?: boolean;
  deleteLabel?: string;
  /** A violet border, for a card that wants acting on. */
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const t = useT();

  return (
    <Card
      data-project={project.id}
      onClick={() => router.push(href)}
      className={`cursor-pointer flex flex-col gap-3 relative group ${
        highlight ? "border-violet border-[1.5px]" : ""
      }`}
    >
      {onDelete && (
        <button
          type="button"
          aria-label={deleteLabel}
          disabled={deleting}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-3 right-3 bg-none border-none cursor-pointer p-1 text-slate opacity-0 group-hover:opacity-100 hover:text-overdue transition-opacity"
        >
          <Trash2 size={14} />
        </button>
      )}

      {/* The status as a word rather than a stamp. The stamp was a 52px
          decorative disc doing the job a five-character label does, on a card
          whose whole point is scanning a row of them quickly. */}
      <div className={`font-body font-semibold text-caption uppercase tracking-wide ${STATUS_TEXT[project.status] ?? "text-slate"}`}>
        {statusLabel(project.status, t)}
      </div>
      <div className="font-body font-bold text-lead text-ink pr-5">{project.title}</div>
      <div className="text-slate text-small">{project.client}</div>
      <div className="font-body text-meta text-text-muted">{project.meta}</div>

      <div className="h-1.5 bg-paper rounded-full">
        <div
          className={`h-1.5 rounded-full ${STATUS_FILL[project.status] ?? "bg-violet"}`}
          style={{ width: `${Math.max(6, project.progress * 100)}%` }}
        />
      </div>

      {children && (
        <div className="mt-auto pt-1" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </Card>
  );
}

/** The grid these sit in, so every screen spaces them the same way. */
export function ProjectCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[18px]">
      {children}
    </div>
  );
}
