/**
 * Helpers for the "add a link" inputs in onboarding and Memory.
 *
 * People type "linkedin.com/in/me", not "https://linkedin.com/in/me", and
 * they shouldn't have to name a link before saving it. Both of these exist
 * so the form can accept what someone actually types.
 */

/** Adds a scheme if the user left it off, so "acme.com" is stored as a real
 * URL rather than something that resolves as a relative path when clicked. */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** A sensible default label for a link the user didn't name: the hostname
 * without "www.". Falls back to the raw input if it won't parse as a URL. */
export function hostnameOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return url.trim();
  }
}
