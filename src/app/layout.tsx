import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Raleway } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n/context";
import { currentLocale } from "@/lib/i18n/server";

const fontDisplay = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["italic", "normal"],
  variable: "--font-display",
});
const fontBody = Raleway({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});
// "Neutra Text Light Alt" is a commercial font, not available via Google
// Fonts — there's no file to load here, so this variable just sets the
// font-family *name* with a clean sans-serif fallback stack. If a licensed
// Neutra Text Light Alt font file (.otf/.ttf/.woff2) is added under
// src/fonts/, wire it up with next/font/local using this same variable name
// and real rendering will kick in everywhere --font-label is used.
const fontLabelFamily = `"Neutra Text Light Alt", "Neutra Text", ui-sans-serif, -apple-system, sans-serif`;

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
    <html lang={locale} style={{ "--font-label": fontLabelFamily } as React.CSSProperties}>
      <body className={`${fontDisplay.variable} ${fontBody.variable} antialiased font-body text-ink`}>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
