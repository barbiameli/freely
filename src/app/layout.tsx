import type { Metadata } from "next";
import { Instrument_Serif, Raleway } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ "--font-label": fontLabelFamily } as React.CSSProperties}>
      <body className={`${fontDisplay.variable} ${fontBody.variable} antialiased font-body text-ink`}>
        {children}
      </body>
    </html>
  );
}
