import { LocaleProvider } from "@/lib/i18n/context";
import { currentLocale } from "@/lib/i18n/server";

/**
 * The language, for onboarding.
 *
 * Same missing provider as the auth screens: the heading came out in Spanish
 * and the three steps under it in English, because the steps are client
 * components and the context default is English.
 *
 * currentLocale is right here even though there is an account by now: it checks
 * the cookie first, which is what the switcher on the marketing page wrote, so
 * the language someone chose before signing up carries into their first run
 * rather than being replaced by whatever their browser said.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <LocaleProvider locale={await currentLocale()}>{children}</LocaleProvider>;
}
