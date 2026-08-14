import { prisma } from "@/lib/prisma";
import type { EmailKind } from "@/lib/email-kinds";

/**
 * Typed access to PasswordReset and EmailLog.
 *
 * Both models are declared in schema.prisma, but the Prisma client generated in
 * this environment predates them and cannot be regenerated here (no network
 * access to fetch the query engine). Same approach as lib/invoice-db and
 * lib/track-db: the cast is confined to this one file and the row shapes are
 * written out, so nothing else in the codebase has to know. Once a deploy
 * regenerates the client this becomes a redundant wrapper.
 *
 * Note what the reset row does not contain: the token. Only its hash is ever
 * stored, so a leaked backup of this table opens nothing.
 */
export interface PasswordResetRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  requestIp: string | null;
}

export interface EmailLogRow {
  id: string;
  userId: string | null;
  to: string;
  kind: EmailKind;
  subject: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  error: string | null;
  subjectId: string | null;
  createdAt: Date;
}

interface Delegate<Row> {
  create(args: { data: Record<string, unknown> }): Promise<Row>;
  findUnique(args: { where: Record<string, unknown>; select?: Record<string, boolean> }): Promise<Row | null>;
  findFirst(args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    select?: Record<string, boolean>;
  }): Promise<Row | null>;
  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    select?: Record<string, boolean>;
    take?: number;
  }): Promise<Row[]>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
  groupBy(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
}

const client = prisma as unknown as {
  passwordReset: Delegate<PasswordResetRow>;
  emailLog: Delegate<EmailLogRow>;
};

export const resetDb = client.passwordReset;
export const emailDb = client.emailLog;
