/**
 * The wordmark, from the brand files.
 *
 * Briefly this was drawn here in the display face with a curve under it,
 * because the old artwork was a flattened export in the previous serif and
 * could not follow the rebrand. The real mark exists now, so it is used: the
 * letterforms are drawn rather than set, and the line is the brand's own
 * rather than my approximation of it.
 *
 * Three tones, because the mark appears on three grounds and each has its own
 * file. `dark` is the white lockup for the ink panel, and `mono` inherits the
 * surrounding text colour for anywhere the mark has to be one flat value.
 */

const SIZES = {
  sm: 92,
  md: 124,
  lg: 168,
} as const;

/** The mark's own proportions, so nothing is ever stretched to fit a box. */
const LOCKUP = 1319 / 2702;
const WORDMARK = 905 / 2592;

export function FreelyLogo({
  size = "md",
  tone = "light",
  /**
   * With the line, which is the full lockup.
   *
   * Off for the places where the mark sits inside something the line would
   * run into, like a dense footer row.
   */
  withLine = true,
}: {
  size?: keyof typeof SIZES;
  tone?: "light" | "dark" | "mono";
  withLine?: boolean;
}) {
  const width = SIZES[size];
  const ratio = withLine ? LOCKUP : WORDMARK;

  const file = withLine
    ? tone === "dark"
      ? "/brand/freely-logo-on-dark.svg"
      : tone === "mono"
        ? "/brand/freely-logo-mono.svg"
        : "/brand/freely-logo.svg"
    : tone === "mono"
      ? "/brand/freely-wordmark-mono.svg"
      : "/brand/freely-wordmark.svg";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={file}
      alt="Freely"
      width={width}
      height={Math.round(width * ratio)}
      style={{ width, height: "auto" }}
    />
  );
}
