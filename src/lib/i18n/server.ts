import { headers, cookies } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import {
  dict,
  localeFromHeader,
  parseLocale,
  LOCALE_COOKIE,
  LOCALES,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";

/**
 * Which language to render in, on the server.
 *
 * Three sources, most deliberate first. The cookie is only ever written by
 * someone using the switcher, so it wins: it is the one signal that is
 * definitely a choice. The account column comes next and carries that choice
 * between devices. Accept-Language is the guess made for a first-time visitor
 * who has not said anything yet.
 *
 * The cookie sits above the account on purpose. A signed-in user's locale
 * travels on the session token, which does not change the moment the column
 * does, so reading the account first would make the switcher look broken until
 * the session refreshed.
 */
export async function currentLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (chosen && (LOCALES as readonly string[]).includes(chosen)) return parseLocale(chosen);

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
