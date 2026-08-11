import type { Dictionary } from "@/lib/i18n";

export type ProjectStatusValue = "ACTIVE" | "DUE" | "OVERDUE" | "DONE";

/**
 * The status, in words a client can read.
 *
 * Both the diary and the public client page printed the column value straight
 * out of the database: "Status: ACTIVE", "Status: OVERDUE". Shouting a database
 * enum at a paying client is not a status update, and OVERDUE in particular
 * reads as an accusation when the delay is often on their side.
 */
export function statusLabel(status: string, t: Dictionary): string {
  switch (status) {
    case "DONE":
      return t.track.statusDone;
    case "DUE":
      return t.track.statusDue;
    case "OVERDUE":
      return t.track.statusOverdue;
    default:
      return t.track.statusActive;
  }
}

/** Text colour per status, shared so the diary and the public page agree. */
export const STATUS_TEXT: Record<string, string> = {
  ACTIVE: "text-violet",
  DUE: "text-coral",
  OVERDUE: "text-overdue",
  DONE: "text-success",
};

/** Bar fill per status, matching the Track cards. */
export const STATUS_FILL: Record<string, string> = {
  ACTIVE: "bg-violet",
  DUE: "bg-coral",
  OVERDUE: "bg-overdue",
  DONE: "bg-success",
};

/**
 * Whether a project counts as finished, for splitting the diary into current
 * and past work.
 *
 * Status first, then every deliverable being ticked: a project whose work is
 * all done is finished whether or not anyone remembered to change the status.
 */
export function isFinished(project: {
  status: string;
  deliverables: { done: boolean }[];
}): boolean {
  if (project.status === "DONE") return true;
  return project.deliverables.length > 0 && project.deliverables.every((d) => d.done);
}
