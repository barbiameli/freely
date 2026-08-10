import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import { dict, localeFromHeader, parseLocale, type Dictionary, type Locale } from "@/lib/i18n";

/**
 * The signed-in user's language, on the server.
 *
 * Falls back to the browser's Accept-Language for anyone not signed in, so the
 * marketing page and the auth screens are in the right language before there
 * is an account to store a preference on.
 */
export async function currentLocale(): Promise<Locale> {
  // getCurrentUser rather than requireUser: signed out is the normal case on
  // the marketing and auth screens, and requireUser signals that by throwing a
  // redirect, which a catch here would swallow.
  const user = await getCurrentUser();
  const saved = (user as unknown as { locale?: string } | null)?.locale;
  if (saved) return parseLocale(saved);

  const header = (await headers()).get("accept-language");
  return localeFromHeader(header);
}

export async function serverDict(): Promise<Dictionary> {
  return dict(await currentLocale());
}
