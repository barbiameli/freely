import { HostedAnalytics } from "@/components/hosted-analytics";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n/context";
import { currentLocale } from "@/lib/i18n/server";

const fontDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-display",
  display: "swap",
});
const fontBody = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
/**
 * Figures, dates, references and status pills.
 *
 * This variable used to name a licensed face with no file behind it, so it
 * rendered as the fallback sans everywhere it was used and the distinction it
 * was meant to draw did not exist.
 */
const fontMono = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Freely",
  description: "Quote, track, and report on client work, powered by AI.",
};

/** Without this, mobile browsers render at a ~980px virtual width and scale
 * the whole page down, so everything looks tiny however carefully the
 * breakpoints are written. maximumScale is left alone deliberately: capping
 * zoom breaks pinch-to-zoom for anyone who needs it. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * The provider sits here, at the root, rather than once per route group.
 *
 * It was mounted in (app), (auth) and (onboarding) separately, which meant
 * anything outside all three had no provider and silently fell back to English:
 * the error and not-found pages, and the public quote page, where it left the
 * paragraph the client agrees to in the wrong language on a Spanish quote.
 * Nothing failed, because a missing provider has a working default, which is
 * exactly what makes it easy to miss.
 *
 * One provider at the root means a new page cannot forget it. The public quote
 * page still overrides it below, because that page follows the quote's language
 * rather than the reader's.
 *
 * lang on <html> is set from the same value, so a screen reader uses the right
 * pronunciation and a browser offers to translate the right way round.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await currentLocale();

  return (
    <html lang={locale}>
      <body
        className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable} antialiased font-body text-ink`}
      >
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
        {/* Nothing unless a key is set. See the component: this is the only
            thing here that tells a third party anything. */}
        <HostedAnalytics />
      </body>
    </html>
  );
}
