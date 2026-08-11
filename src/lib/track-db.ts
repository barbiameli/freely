import { prisma } from "@/lib/prisma";

/**
 * Typed access to Track's newer tables and columns.
 *
 * Same situation as invoice-db: Step, Flag, and the date columns on Project
 * and Deliverable are declared in schema.prisma, but the Prisma client
 * generated in this environment predates them and can't be regenerated here
 * (no network access for the query engine). The cast is confined to this one
 * file with the row shapes written out, rather than hand-editing generated
 * types, which went badly last time. Once a deploy regenerates the client
 * this becomes a redundant wrapper and can be deleted.
 */
export type FlagKind = "BLOCKER" | "ASSUMPTION" | "WORTH_ASKING";

export interface StepRow {
  id: string;
  deliverableId: string;
  name: string;
  done: boolean;
  order: number;
  estimateHours: number;
  createdAt: Date;
}

export interface FlagRow {
  id: string;
  deliverableId: string;
  question: string;
  reason: string | null;
  kind: FlagKind;
  resolved: boolean;
  createdAt: Date;
}

export interface DeliverableRow {
  id: string;
  projectId: string;
  name: string;
  done: boolean;
  order: number;
  dueAt: Date | null;
  summary: string | null;
  brokenDownAt: Date | null;
  invoicedAt: Date | null;
  /** Which milestone covers it, null on a project not billed that way. */
  milestoneId: string | null;
}

/** A deliverable with everything hanging off it, which is how Track reads
 * them almost everywhere. */
export interface DeliverableWithDetail extends DeliverableRow {
  steps: StepRow[];
  flags: FlagRow[];
}

interface Delegate<Row, CreateData, UpdateData> {
  findFirst(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    include?: Record<string, unknown>;
  }): Promise<Row | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
    include?: Record<string, unknown>;
    take?: number;
  }): Promise<Row[]>;
  create(args: { data: CreateData }): Promise<Row>;
  createMany(args: { data: CreateData[] }): Promise<{ count: number }>;
  update(args: { where: { id: string }; data: UpdateData }): Promise<Row>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: UpdateData;
  }): Promise<{ count: number }>;
  delete(args: { where: { id: string } }): Promise<Row>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

type StepCreate = { deliverableId: string; name: string; order?: number; estimateHours?: number };
type StepUpdate = Partial<Pick<StepRow, "name" | "done" | "order" | "estimateHours">>;
type FlagCreate = {
  deliverableId: string;
  question: string;
  reason?: string | null;
  kind?: FlagKind;
};
type FlagUpdate = Partial<Pick<FlagRow, "question" | "reason" | "kind" | "resolved">>;
type DeliverableCreate = {
  projectId: string;
  name: string;
  order?: number;
  dueAt?: Date | null;
  summary?: string | null;
};
type DeliverableUpdate = Partial<
  Pick<DeliverableRow, "name" | "done" | "order" | "dueAt" | "summary" | "brokenDownAt">
>;

/**
 * A milestone: a billable chunk grouping deliverables.
 *
 * Through the same contained cast as steps and flags, for the same reason: the
 * generated client in this environment predates the table.
 */
export interface MilestoneRow {
  id: string;
  projectId: string;
  name: string;
  order: number;
  /** What closes it beyond the deliverables, when there is such a thing. */
  gate: string | null;
  amount: number;
  invoicedAt: Date | null;
}
type MilestoneCreate = {
  projectId: string;
  name: string;
  order?: number;
  gate?: string | null;
  amount?: number;
};
type MilestoneUpdate = Partial<
  Pick<MilestoneRow, "name" | "order" | "gate" | "amount" | "invoicedAt">
>;

interface TrackClient {
  step: Delegate<StepRow, StepCreate, StepUpdate>;
  flag: Delegate<FlagRow, FlagCreate, FlagUpdate>;
  deliverable: Delegate<DeliverableWithDetail, DeliverableCreate, DeliverableUpdate>;
  milestone: Delegate<MilestoneRow, MilestoneCreate, MilestoneUpdate>;
}

const client = prisma as unknown as TrackClient;

export const stepDb = client.step;
export const flagDb = client.flag;
export const deliverableDb = client.deliverable;
export const milestoneDb = client.milestone;

/** Project's two new date columns, which the generated client also predates. */
export interface ProjectSchedule {
  startDate: Date | null;
  dueDate: Date | null;
}

export function projectSchedule(project: unknown): ProjectSchedule {
  const p = project as Partial<ProjectSchedule>;
  return { startDate: p.startDate ?? null, dueDate: p.dueDate ?? null };
}
