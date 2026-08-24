import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { funnel, rate, activeUsers, retention, perDay, byKind, type EventRow } from "@/lib/metrics";
import { InsightsView } from "./insights-view";

/**
 * How Freely is being used.
 *
 * This is the product's own dashboard, not a freelancer's. It answers questions
 * about whether the thing works: do people finish a quote, does a quote reach a
 * client, does a signed quote get tracked, does tracked work get invoiced.
 *
 * Only the owner can open it, decided by ADMIN_EMAIL. A missing variable means
 * nobody, which is the right default: a page listing what every account does is
 * one that should fail closed rather than fail open, and a 404 rather than a 403
 * so its existence is not advertised.
 *
 * Nothing here is per-person. The numbers are counts and rates across everybody,
 * because the question is whether the product works, not what any individual is
 * doing with it.
 */
export const dynamic = "force-dynamic";

/** How far back the whole page looks. */
const WINDOW_DAYS = 30;

export default async function InsightsPage() {
  const user = await requireFullUser();
  const admin = process.env.ADMIN_EMAIL;
  // Fails closed, and looks like nothing rather than like a locked door.
  if (!admin || user.email.toLowerCase() !== admin.toLowerCase()) notFound();

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600_000);
  const rows = (await (
    prisma as unknown as {
      event: {
        findMany(args: {
          where: Record<string, unknown>;
          select: Record<string, boolean>;
        }): Promise<EventRow[]>;
      };
    }
  ).event.findMany({
    where: { createdAt: { gte: since } },
    select: { kind: true, userId: true, subjectId: true, createdAt: true },
  })) as EventRow[];

  const steps = funnel(rows);
  const [accounts, tracked, subscribers, sends] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    // Who said yes to product news. Both columns are newer than the generated
    // client here, so the select goes through a cast. See lib/mail-db.
    (
      prisma as unknown as {
        user: {
          findMany(args: Record<string, unknown>): Promise<
            {
              email: string;
              marketingOptInAt: Date | null;
              marketingOptInSource: string | null;
            }[]
          >;
        };
      }
    ).user.findMany({
      where: { marketingOptIn: true },
      select: { email: true, marketingOptInAt: true, marketingOptInSource: true },
      orderBy: { marketingOptInAt: "desc" },
    }),
    (
      prisma as unknown as {
        emailLog: {
          findMany(args: Record<string, unknown>): Promise<
            {
              to: string;
              kind: string;
              status: "SENT" | "FAILED" | "SKIPPED";
              createdAt: Date;
              error: string | null;
            }[]
          >;
        };
      }
    ).emailLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { to: true, kind: true, status: true, createdAt: true, error: true },
    }),
  ]);

  return (
    <InsightsView
      windowDays={WINDOW_DAYS}
      accounts={accounts}
      projects={tracked}
      active={activeUsers(rows)}
      funnel={steps}
      rates={{
        // Each rate is against the step before it, so every one answers "of the
        // ones that got this far, how many went on".
        published: rate(steps.published, steps.generated),
        accepted: rate(steps.accepted, steps.published),
        tracked: rate(steps.tracked, steps.accepted),
        invoiced: rate(steps.invoiced, steps.tracked),
      }}
      retention={retention(rows, since)}
      quotesPerDay={perDay(rows, "quote_generated", 14)}
      kinds={byKind(rows).slice(0, 10)}
      empty={rows.length === 0}
      accountsTotal={accounts}
      subscribers={subscribers.map((u) => ({
        email: u.email,
        since: u.marketingOptInAt,
        source: u.marketingOptInSource,
      }))}
      sends={sends}
    />
  );
}
