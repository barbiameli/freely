import { prisma } from "@/lib/prisma";
import { emailDb } from "@/lib/mail-db";
import { isTransactional, type EmailKind } from "@/lib/email-kinds";
import { maySend, type ConsentState } from "@/lib/marketing";

/**
 * Sending email, over Resend's REST API.
 *
 * Deliberately a fetch call rather than a dependency: it is one POST, and the
 * SDK would be another package in the deploy for no gain.
 *
 * Everything here is best-effort. Nothing the app does for a user should fail
 * because a notification could not be delivered, so send() resolves either way
 * and logs the reason. That matters most on the acceptance path: a client
 * clicking "accept" must not see an error because the freelancer's email
 * provider was having a bad morning.
 *
 * With no RESEND_API_KEY set, this no-ops and says so once in the log. The app
 * works without email configured, it just goes quiet.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Where mail comes from.
 *
 * Resend will only deliver from a domain you have verified, with one exception:
 * onboarding@resend.dev, which it accepts but only delivers to the address that
 * owns the account. That is enough to get notifications working before a domain
 * is set up, which is why it is the fallback rather than an error.
 */
function sender(): string {
  return process.env.EMAIL_FROM || "Freely <onboarding@resend.dev>";
}

/**
 * The app's own address, for links that leave the app and have to come back.
 *
 * The order matters more than it looks. VERCEL_URL is the address of one
 * deployment, and every push replaces it: a link built from it works today and
 * returns DEPLOYMENT_NOT_FOUND next week. That is survivable in a password reset
 * that expires in an hour, and not survivable in a client's project page, which
 * is a link somebody sends to a paying customer and expects to keep working.
 *
 * VERCEL_PROJECT_PRODUCTION_URL is the stable production domain and is tried
 * first, so a deployment address is only ever used on a preview build where
 * there is nothing else.
 *
 * NEXT_PUBLIC_APP_URL beats both, and should be set to the real domain in
 * production. If it is set to a deployment address, this cannot save you.
 */
export function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  // The project's own domain, stable across deployments.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  // One deployment's address. Replaced on the next push, so it is the last
  // resort rather than the obvious answer.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export interface Email {
  to: string;
  subject: string;
  /** Plain text, one paragraph per line. Wrapped into simple HTML below. */
  lines: string[];
  action?: { label: string; url: string };
}

/** Wraps the lines in the least amount of HTML that still reads well in a mail
 * client. No images, no external CSS: those get stripped or blocked, and this
 * is a short notification, not a newsletter. */
function html(email: Email): string {
  const paragraphs = email.lines
    .map(
      (line) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#2E2E2E">${escape(line)}</p>`
    )
    .join("");
  const button = email.action
    ? `<p style="margin:22px 0 0"><a href="${escape(email.action.url)}" style="display:inline-block;background:#6320EE;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:8px">${escape(
        email.action.label
      )}</a></p>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px 20px">${paragraphs}${button}</div>`;
}

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let warnedAboutMissingKey = false;

/**
 * What this message is about, so it can be found again.
 *
 * Every send is recorded. Three things need that record and none of them can be
 * reconstructed afterwards: a nudge has to know it has already been sent, a
 * failure has to be visible rather than silent, and "did that go out" has to
 * have an answer.
 *
 * No body is stored. Knowing a reset email was sent is operations; keeping its
 * contents is keeping a copy of somebody's mail.
 */
export interface SendContext {
  kind: EmailKind;
  userId?: string;
  /** A brief or project id, so a nudge can find its own last send without
   * scanning subject lines. */
  subjectId?: string;
}

async function record(
  email: Email,
  context: SendContext | undefined,
  status: "SENT" | "FAILED" | "SKIPPED",
  error?: string
): Promise<void> {
  if (!context) return;
  try {
    await emailDb.create({
      data: {
        to: email.to,
        kind: context.kind,
        subject: email.subject,
        status,
        userId: context.userId ?? null,
        subjectId: context.subjectId ?? null,
        error: error?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    // The log failing must not fail the send. A missing row is a gap in the
    // record; a thrown error here would be a client seeing an error because a
    // logging table was unhappy.
    console.error("[email] could not log", err);
  }
}

/** Sends, or explains in the log why it did not. Never throws. */
export async function send(
  email: Email,
  context?: SendContext
): Promise<{ sent: boolean; reason?: string }> {
  // Consent, checked here rather than at each call site. This is the kind of
  // rule that gets followed everywhere except the one place somebody was in a
  // hurry, and the cost of that one place is a complaint to a regulator rather
  // than a bug report. Transactional mail passes straight through: somebody who
  // unsubscribed from product news has not asked to stop being told their
  // password changed.
  if (context && !isTransactional(context.kind)) {
    // No select: the consent columns are newer than the generated Prisma
    // client here, and narrowing to what it knows would return them undefined,
    // which reads as "not opted in" and would quietly stop all marketing. That
    // is the safe direction to fail, but failing silently either way is worse
    // than reading the whole row.
    const consent = context.userId
      ? ((await prisma.user.findUnique({
          where: { id: context.userId },
        })) as unknown as ConsentState | null)
      : null;
    if (!maySend(context.kind, consent)) {
      await record(email, context, "SKIPPED", "not opted in");
      return { sent: false, reason: "not opted in" };
    }
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!warnedAboutMissingKey) {
      warnedAboutMissingKey = true;
      console.warn(
        "[email] RESEND_API_KEY is not set, so notifications are off. Everything else works."
      );
    }
    // Recorded rather than dropped: afterwards, "not configured" and "we never
    // tried" look identical otherwise.
    await record(email, context, "SKIPPED", "no api key");
    return { sent: false, reason: "no api key" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(),
        to: [email.to],
        subject: email.subject,
        text: email.lines.join("\n\n"),
        html: html(email),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] send failed", res.status, body.slice(0, 300));
      await record(email, context, "FAILED", `http ${res.status}: ${body.slice(0, 200)}`);
      return { sent: false, reason: `http ${res.status}` };
    }
    await record(email, context, "SENT");
    return { sent: true };
  } catch (err) {
    console.error("[email] send threw", err);
    await record(email, context, "FAILED", err instanceof Error ? err.message : "network");
    return { sent: false, reason: "network" };
  }
}

/**
 * When this kind of message was last sent to this person.
 *
 * The whole reason for the log. A nudge that cannot see its own history sends
 * itself every time the cron runs.
 */
export async function lastSentAt(
  userId: string,
  kind: EmailKind,
  subjectId?: string
): Promise<Date | null> {
  const last = await emailDb.findFirst({
    where: {
      userId,
      kind,
      status: "SENT",
      ...(subjectId ? { subjectId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return last?.createdAt ?? null;
}
