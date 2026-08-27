import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailDb } from "@/lib/mail-db";
import { send, appUrl } from "@/lib/email";
import { nudgeFor, type Nudge } from "@/lib/nudges";

/**
 * The daily nudge run.
 *
 * Scheduled by vercel.json, which calls this once on weekday mornings. All the
 * deciding lives in lib/nudges, which is pure and tested; this reads the state,
 * asks it what to send, and sends it.
 *
 * Three things about how it runs.
 *
 * It is authenticated. An open endpoint that sends email to every user is a
 * button anybody on the internet can press as often as they like, and the
 * consequence is not load, it is the domain's sending reputation.
 *
 * It writes what it sent, before deciding what to send tomorrow. The log is
 * what stops the same message going out every morning, so a failure to record
 * matters more here than a failure to send.
 *
 * And it never throws. A cron that 500s gets retried, and a retried send is a
 * duplicate email.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * How many people one run will look at.
 *
 * Sized against the sixty seconds this has and the three queries each person
 * costs. Whoever is not reached today is at the front of the queue tomorrow,
 * because the order is by who has waited longest.
 */
const RUN_LIMIT = 200;

/** Somebody worth considering. Everyone else is skipped before any query. */
interface Recipient {
  id: string;
  email: string;
  createdAt: Date;
  nudgeEmails: boolean;
  lastNudgeAt: Date | null;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Refusing to run is the right failure. Running unauthenticated because the
    // secret is missing is how this becomes an open mailer.
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();
  let considered = 0;
  let sent = 0;

  try {
    /**
     * Who to consider, oldest nudge first, and only so many in one run.
     *
     * This used to load every user, in whatever order the database returned
     * them, and work through the lot. Two problems, both invisible until there
     * are users. It reads every column of every row, including the Memory
     * fields, to use five of them. And the run has sixty seconds: once there
     * are more people than fit, the ones at the end of the list are never
     * reached, and it is the same ones every morning because the order does
     * not change.
     *
     * Ordering by when each person was last nudged fixes the second properly
     * rather than by raising the cap: whoever waited longest goes first, so a
     * run that runs out of time resumes at the right place tomorrow.
     *
     * The select and the ordering both go through a cast, because nudgeEmails
     * and lastNudgeAt are newer than the generated client in this checkout.
     */
    const users = (await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
        nudgeEmails: true,
        lastNudgeAt: true,
      },
      where: { nudgeEmails: true },
      orderBy: [{ lastNudgeAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      take: RUN_LIMIT,
    } as unknown as Parameters<typeof prisma.user.findMany>[0])) as unknown as Recipient[];

    for (const user of users) {
      // Off is off, and worth checking before doing any work for them. The
      // decision function is told true because this has already answered it.
      if (!user.nudgeEmails) continue;
      considered++;

      const [briefs, projects, recentLogs] = await Promise.all([
        prisma.brief.findMany({
          where: { userId: user.id },
          include: { project: { select: { id: true } } },
        }),
        prisma.project.findMany({
          where: { userId: user.id, status: "ACTIVE" },
          include: { deliverables: true },
        }),
        emailDb.findMany({
          where: {
            userId: user.id,
            status: "SENT",
            createdAt: { gt: new Date(now.getTime() - 30 * 24 * 3600_000) },
          },
          select: { subjectId: true, createdAt: true },
        }),
      ]);

      // When each subject was last mentioned, so nothing is raised twice in a
      // week. Newest wins, since findMany here is not ordered.
      const lastBySubject: Record<string, Date> = {};
      for (const log of recentLogs) {
        if (!log.subjectId) continue;
        const existing = lastBySubject[log.subjectId];
        if (!existing || existing < log.createdAt) lastBySubject[log.subjectId] = log.createdAt;
      }

      const nudge = nudgeFor({
        now,
        createdAt: user.createdAt,
        nudgeEmails: true,
        lastNudgeAt: user.lastNudgeAt ?? null,
        lastBySubject,
        quotes: briefs.map((b) => {
          const row = b as unknown as { acceptedAt?: Date | null; outcome?: string };
          return {
            id: b.id,
            title: b.title,
            client: b.client,
            since: row.acceptedAt ?? b.createdAt,
            tracked: Boolean(b.project) || b.status === "TRACKED",
            // Signed by the client, or marked won by the freelancer. Both mean
            // the work is real and is not being tracked.
            accepted: Boolean(row.acceptedAt) || row.outcome === "WON",
          };
        }),
        deliverables: projects.flatMap((p) =>
          p.deliverables
            .filter((d) => d.dueAt)
            .map((d) => ({
              id: d.id,
              name: d.name,
              projectId: p.id,
              projectTitle: p.title,
              dueAt: d.dueAt as Date,
              done: d.done,
            }))
        ),
      });

      if (!nudge) continue;

      const message = compose(nudge, user.email);
      const result = await send(message.email, {
        kind: nudge.kind,
        userId: user.id,
        subjectId: nudge.subjectId,
      });

      if (result.sent) {
        sent++;
        // Stamped only on a real send. Recording an attempt that failed would
        // silence tomorrow's run for a message nobody received.
        await prisma.user.update({
          where: { id: user.id },
          data: { ...({ lastNudgeAt: now } as Record<string, unknown>) },
        });
      }
    }

    return NextResponse.json({ ok: true, considered, sent });
  } catch (err) {
    // Never a 500. Vercel retries those, and a retried run is a second email.
    console.error("[cron/nudges] failed", err);
    return NextResponse.json({ ok: false, considered, sent, error: "failed" });
  }
}

/**
 * The message itself.
 *
 * Short, specific, and it names the thing. "You have overdue work" is a guilt
 * trip; "Site audit was due Tuesday" is information, and information is what
 * makes somebody open the app rather than close the email.
 *
 * Every one carries a way to stop receiving them, because a message somebody
 * cannot turn off is a message they will report instead.
 */
function compose(nudge: Nudge, to: string) {
  const url = `${appUrl()}${nudge.path}`;
  const more = nudge.others > 0 ? ` And ${nudge.others} more waiting.` : "";
  const settings = `${appUrl()}/account`;

  if (nudge.kind === "NUDGE_OVERDUE") {
    return {
      email: {
        to,
        subject: `${nudge.title} is past its date`,
        lines: [
          `"${nudge.title}" on ${nudge.client} was due and is still open.${more}`,
          "Tick it off if it is done, or move the date if it is not.",
          `Turn these off any time in your account settings: ${settings}`,
        ],
        action: { label: "Open the project", url },
      },
    };
  }

  if (nudge.kind === "NUDGE_TRACK_QUOTE") {
    return {
      email: {
        to,
        subject: `${nudge.client} signed, and it is not in Track yet`,
        lines: [
          `"${nudge.title}" was accepted and has not been sent to Track.${more}`,
          "Tracking it is what turns the quote into deliverables, dates and an invoice.",
          `Turn these off any time in your account settings: ${settings}`,
        ],
        action: { label: "Send it to Track", url },
      },
    };
  }

  return {
    email: {
      to,
      subject: `${nudge.title} is due soon`,
      lines: [
        `"${nudge.title}" on ${nudge.client} is coming up.${more}`,
        `Turn these off any time in your account settings: ${settings}`,
      ],
      action: { label: "Open the project", url },
    },
  };
}
