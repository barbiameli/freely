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

/** The app's own address, for links back into it. */
export function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  // Vercel sets this per deployment, without a scheme.
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

/** Sends, or explains in the log why it did not. Never throws. */
export async function send(email: Email): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!warnedAboutMissingKey) {
      warnedAboutMissingKey = true;
      console.warn(
        "[email] RESEND_API_KEY is not set, so notifications are off. Everything else works."
      );
    }
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
      return { sent: false, reason: `http ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] send threw", err);
    return { sent: false, reason: "network" };
  }
}
