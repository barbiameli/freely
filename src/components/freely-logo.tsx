/**
 * The wordmark.
 *
 * This used to be an <img> pointing at public/brand/logo.svg: the italic
 * "Freely" and a coral swash, exported as one combined path from the old brand
 * file. Because it was flattened artwork rather than type, it was the one
 * thing in the app that could not follow a change of typeface or palette, and
 * after the rebrand it sat in the sidebar in the old serif and the old coral
 * while everything around it had moved.
 *
 * So it is drawn here instead: real text in the display face, and the line
 * under it as a stroke that takes its colour from the palette. Selectable,
 * searchable, and correct at any size without a second export.
 *
 * The line is decorative. The word is the accessible name, so the SVG is
 * hidden from assistive technology rather than labelled twice.
 */

const SIZES = {
  sm: 21,
  md: 25,
  lg: 34,
} as const;

export function FreelyLogo({ size = "md" }: { size?: keyof typeof SIZES }) {
  const fontSize = SIZES[size];

  return (
    <span className="inline-flex flex-col items-start select-none">
      <span
        className="font-display leading-none text-ink lowercase"
        style={{
          fontSize,
          fontWeight: 800,
          // Tighter than the headings, which are at -0.035em. The wordmark is
          // one word read as a shape, so it closes up further than a line of
          // display text would.
          letterSpacing: "-0.05em",
        }}
      >
        freely
      </span>
      {/*
        Full width of the word, whatever the word measures once the font has
        loaded. non-scaling-stroke keeps the line at its real weight while the
        SVG stretches, which a plain stroke-width would not: scaled to fit a
        72px word it would come out thinner than scaled to fit a 98px one.
      */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: Math.round(fontSize * 0.32), marginTop: 2 }}
      >
        <path
          d="M1,4.4 C22,4.4 30,1.6 50,1.6 C70,1.6 78,4.4 99,4.4"
          fill="none"
          stroke="var(--a1)"
          strokeWidth={3.4}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
