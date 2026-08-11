import { LocaleProvider } from "@/lib/i18n/context";
import { currentLocale } from "@/lib/i18n/server";

/**
 * The language, for the sign-in and signup screens.
 *
 * Without this, these pages were half translated in a way that looked like
 * missing strings but was not: the server-rendered heading read the language
 * correctly and every client component under it fell back to the context
 * default, which is English. So someone who picked Spanish on the marketing
 * page got "Crea la cuenta de tu estudio." above "Your name" and a "Create
 * account" button.
 *
 * currentLocale rather than the user's saved column, because nobody is signed
 * in here yet: it reads the cookie the switcher writes, then the browser's
 * Accept-Language.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return <LocaleProvider locale={await currentLocale()}>{children}</LocaleProvider>;
}
