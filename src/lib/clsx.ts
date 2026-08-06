/** Minimal className joiner — avoids pulling in a dependency for it. */
export default function clsx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
