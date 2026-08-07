/** Freely's real logo lockup, exported straight from the brand Figma file:
 * the italic "Freely" wordmark plus the coral free-form swash, drawn as one
 * combined SVG (not reconstructed from a web font + a separately-placed
 * line). One shared component so every place the logo appears (sidebar,
 * auth pages, marketing site) stays in sync — see public/brand/logo.svg. */

const SIZES = {
  sm: 90,
  md: 120,
  lg: 160,
} as const;

// Original artwork is 90x63 (viewBox), so height follows from width at that
// same ~1.43:1 ratio to avoid distorting the mark.
const ASPECT_RATIO = 63 / 90;

export function FreelyLogo({ size = "md" }: { size?: keyof typeof SIZES }) {
  const width = SIZES[size];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo.svg"
      alt="Freely"
      width={width}
      height={Math.round(width * ASPECT_RATIO)}
      style={{ width, height: "auto" }}
    />
  );
}
