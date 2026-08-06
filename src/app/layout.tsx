import type { Metadata } from "next";
import { Instrument_Serif, Raleway, Architects_Daughter } from "next/font/google";
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
const fontLabel = Architects_Daughter({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-label",
});

export const metadata: Metadata = {
  title: "Freely",
  description: "Quote, track, and report on client work — powered by AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fontDisplay.variable} ${fontBody.variable} ${fontLabel.variable} antialiased font-body text-ink`}
      >
        {children}
      </body>
    </html>
  );
}
