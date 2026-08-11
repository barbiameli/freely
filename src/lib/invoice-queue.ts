import { billableMilestones } from "@/lib/milestones";

/**
 * What can be invoiced right now, and for how much.
 *
 * Kept as pure functions so the rules can be tested without a database. The
 * money is decided here, which is the part worth being able to check.
 */
export type BillingMode = "ON_COMPLETION" | "PER_MILESTONE";

export interface QueueStep {
  estimateHours: number;
}

export interface QueueDeliverable {
  id: string;
  name: string;
  done: boolean;
  invoicedAt: Date | null;
  /** Which milestone it belongs to, on a project billed that way. */
  milestoneId?: string | null;
  steps: QueueStep[];
}

/** A milestone as the queue needs it: what it is worth and whether it is paid. */
export interface QueueMilestone {
  id: string;
  name: string;
  order: number;
  amount: number;
  invoicedAt: Date | null;
}

export interface QueueProject {
  id: string;
  title: string;
  client: string;
  price: number;
  hours: number;
  currency: string;
  billing: BillingMode;
  status: string;
  deliverables: QueueDeliverable[];
  /**
   * The milestones agreed on the quote, empty on a project without them.
   *
   * A milestone groups deliverables, so this is the unit that gets billed. It
   * used to be the deliverable, which meant a six-deliverable project agreed as
   * three milestones invoiced six times for a sixth each: the wrong amount, and
   * on a day nothing had actually been completed.
   */
  milestones?: QueueMilestone[];
  /** Invoices already raised against this project. */
  invoiceCount: number;
}

export interface BillableLine {
  deliverableId: string | null;
  title: string;
  hours: number;
  amount: number;
}

/** Why a project is not ready, so the interface can say so rather than just
 * omitting it. */
export type NotReady = "nothing-done" | "in-progress" | "already-invoiced";

export interface QueueEntry {
  project: QueueProject;
  /** Empty when there is nothing to bill yet. */
  lines: BillableLine[];
  total: number;
  notReady: NotReady | null;
}

export function estimatedHours(deliverable: QueueDeliverable): number {
  return deliverable.steps.reduce((sum, s) => sum + (s.estimateHours || 0), 0);
}

/**
 * Splits a project's price across its deliverables.
 *
 * By estimated hours where those exist, because that is the closest thing to
 * what each piece is actually worth. Where no deliverable has an estimate, an
 * equal split is the only honest fallback: inventing weights from the names
 * would be a guess dressed up as arithmetic.
 *
 * The last share absorbs the rounding remainder, so the milestone invoices
 * always sum to exactly the project price. Billing 3 x 33.33 against a 100
 * project and quietly losing a penny is the kind of thing a client notices.
 */
export function splitPrice(project: QueueProject): Map<string, number> {
  const shares = new Map<string, number>();
  const deliverables = project.deliverables;
  if (deliverables.length === 0) return shares;

  const totalHours = deliverables.reduce((sum, d) => sum + estimatedHours(d), 0);
  const useHours = totalHours > 0;

  let allocated = 0;
  deliverables.forEach((d, i) => {
    const isLast = i === deliverables.length - 1;
    if (isLast) {
      shares.set(d.id, round2(project.price - allocated));
      return;
    }
    const fraction = useHours ? estimatedHours(d) / totalHours : 1 / deliverables.length;
    const share = round2(project.price * fraction);
    allocated = round2(allocated + share);
    shares.set(d.id, share);
  });

  return shares;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * What is billable on one project.
 *
 * Per milestone: each milestone whose deliverables are all finished, at the
 * amount agreed on the quote. A milestone is the billable unit, not a
 * deliverable: half a milestone is not a fraction of an invoice, it is nothing
 * yet, because the client agreed to pay on the milestone completing.
 *
 * On completion: the whole project, once every deliverable is done and nothing
 * has been invoiced against it yet.
 *
 * A project marked per-milestone with no milestones on it falls back to
 * splitting by deliverable, which is what every project quoted before
 * milestones existed looks like. Refusing to bill those at all would be worse
 * than billing them the old way.
 */
export function billable(project: QueueProject): QueueEntry {
  if (project.billing === "PER_MILESTONE" && project.milestones?.length) {
    const lines = billableMilestones(project.milestones, project.deliverables).map((ms) => ({
      deliverableId: null,
      title: ms.name,
      hours: project.deliverables
        .filter((d) => d.milestoneId === ms.id)
        .reduce((sum, d) => sum + estimatedHours(d), 0),
      amount: ms.amount,
    }));

    const anyUnbilled = project.milestones.some((ms) => !ms.invoicedAt);
    return {
      project,
      lines,
      total: round2(lines.reduce((sum, l) => sum + l.amount, 0)),
      notReady: lines.length ? null : anyUnbilled ? "nothing-done" : "already-invoiced",
    };
  }

  if (project.billing === "PER_MILESTONE") {
    const shares = splitPrice(project);
    const lines = project.deliverables
      .filter((d) => d.done && !d.invoicedAt)
      .map((d) => ({
        deliverableId: d.id,
        title: d.name,
        hours: estimatedHours(d),
        amount: shares.get(d.id) ?? 0,
      }));

    const anyUnbilled = project.deliverables.some((d) => !d.invoicedAt);
    return {
      project,
      lines,
      total: round2(lines.reduce((sum, l) => sum + l.amount, 0)),
      notReady: lines.length
        ? null
        : anyUnbilled
        ? "nothing-done"
        : "already-invoiced",
    };
  }

  const complete =
    project.deliverables.length > 0
      ? project.deliverables.every((d) => d.done)
      : project.status === "DONE";

  if (project.invoiceCount > 0) {
    return { project, lines: [], total: 0, notReady: "already-invoiced" };
  }
  if (!complete) {
    const started = project.deliverables.some((d) => d.done);
    return { project, lines: [], total: 0, notReady: started ? "in-progress" : "nothing-done" };
  }

  return {
    project,
    lines: [
      {
        deliverableId: null,
        title: project.title,
        hours: project.hours,
        amount: round2(project.price),
      },
    ],
    total: round2(project.price),
    notReady: null,
  };
}

/**
 * The invoice queue: everything with work in it, readiest first.
 *
 * Projects with nothing billable are kept rather than filtered out, because
 * "three projects running, none ready to bill yet" is useful information, and a
 * list that silently omits them looks broken when you know the work exists.
 * Already-invoiced projects are dropped: those belong in the invoice list.
 */
export function invoiceQueue(projects: QueueProject[]): QueueEntry[] {
  return projects
    .map(billable)
    .filter((entry) => entry.notReady !== "already-invoiced")
    .sort((a, b) => {
      const readyDiff = Number(Boolean(b.lines.length)) - Number(Boolean(a.lines.length));
      if (readyDiff !== 0) return readyDiff;
      return b.total - a.total;
    });
}

/** How many are ready to bill, for the tab count. */
export function readyCount(entries: QueueEntry[]): number {
  return entries.filter((e) => e.lines.length > 0).length;
}
