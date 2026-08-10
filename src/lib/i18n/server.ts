import { headers } from "next/headers";
import { requireUser } from "@/lib/session";
import { dict, localeFromHeader, parseLocale, type Dictionary, type Locale } from "@/lib/i18n";

/**
 * The signed-in user's language, on the server.
 *
 * Falls back to the browser's Accept-Language for anyone not signed in, so the
 * marketing page and the auth screens are in the right language before there
 * is an account to store a preference on.
 */
export async function currentLocale(): Promise<Locale> {
  try {
    const user = await requireUser();
    const saved = (user as unknown as { locale?: string }).locale;
    if (saved) return parseLocale(saved);
  } catch {
    // Not signed in, which is a normal case here rather than a failure.
  }
  const header = (await headers()).get("accept-language");
  return localeFromHeader(header);
}

export async function serverDict(): Promise<Dictionary> {
  return dict(await currentLocale());
}
