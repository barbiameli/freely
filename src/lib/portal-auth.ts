import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Who may read a Client Portal.
 *
 * The portal is gated, so this is the whole answer: a visitor row, invited by
 * the freelancer, that has proved it holds the address. No row, no access,
 * however good the URL is.
 *
 * That is the change worth being clear about. The unguessable link used to be
 * the credential, which meant access could be forwarded, could not be revoked,
 * and lasted forever. Now the link is only an address; the credential is the
 * person.
 */

export interface PortalVisitorRow {
  id: string;
  clientId: string;
  email: string;
  name: string;
  passwordHash: string | null;
  verifiedAt: Date | null;
  onboardingSeenAt: Date | null;
}

/** The narrow shape: these columns are newer than the generated client. */
export function visitors() {
  return (
    prisma as unknown as {
      portalVisitor: {
        findFirst(args: { where: Record<string, unknown> }): Promise<PortalVisitorRow | null>;
        findMany(args: {
          where: Record<string, unknown>;
          orderBy?: Record<string, unknown>;
        }): Promise<(PortalVisitorRow & { lastSeenAt: Date; invitedAt: Date })[]>;
        create(args: { data: Record<string, unknown> }): Promise<PortalVisitorRow>;
        update(args: {
          where: { id: string };
          data: Record<string, unknown>;
        }): Promise<PortalVisitorRow>;
        updateMany(args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }): Promise<unknown>;
        delete(args: { where: { id: string } }): Promise<unknown>;
        count(args: { where: Record<string, unknown> }): Promise<number>;
      };
    }
  ).portalVisitor;
}

/** Twelve rounds, the same as every other password in this app. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Checking a password without saying whether the address exists.
 *
 * When there is no visitor, this still runs a hash comparison against a dummy
 * value before returning false. Otherwise a wrong address answers in a
 * millisecond and a right one takes eighty, and the sign-in form becomes a way
 * of finding out who a freelancer's clients are.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7Vv5Q7sYbTLBTBrH8w0aE8xPpVo4bqK";

export async function checkPassword(
  visitor: PortalVisitorRow | null,
  password: string
): Promise<boolean> {
  const hash = visitor?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  return Boolean(visitor?.passwordHash) && ok;
}

/** Short, and said once here rather than in three places. */
export const MIN_PASSWORD = 10;

export function passwordProblem(password: string): "short" | null {
  return password.length < MIN_PASSWORD ? "short" : null;
}
