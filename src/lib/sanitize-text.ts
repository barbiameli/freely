/**
 * Strips characters PostgreSQL refuses to store in a text column.
 *
 * The only truly illegal one is the NUL byte (U+0000): Postgres rejects it
 * outright with `22021: invalid byte sequence for encoding "UTF8": 0x00`,
 * which surfaces as a failed INSERT rather than anything readable. Real PDFs
 * produce these regularly once extracted (embedded fonts, form fields and
 * padded strings all leak NULs through text extraction), so any text coming
 * out of a user-uploaded file has to be cleaned before it goes near the
 * database.
 *
 * The other C0 control characters here are legal in Postgres but never
 * meaningful in extracted prose, and they render as garbage in a quote, so
 * they go too. Tab, newline and carriage return are deliberately kept.
 */
/**
 * Replaces em and en dashes with plain punctuation.
 *
 * Applied to generated copy, not to anything typed by hand: the model reaches
 * for em dashes constantly and they are not house style. A dash used as a
 * parenthetical becomes a comma, and one used as a range or a bullet marker
 * becomes a hyphen.
 */
export function stripLongDashes(text: string): string {
  return (
    text
      // " - " style parentheticals.
      .replace(/\s+[\u2013\u2014]\s+/g, ", ")
      // Ranges and closed-up uses: "Week 1-2", "design-led".
      .replace(/[\u2013\u2014]/g, "-")
      // A comma landing next to other punctuation reads as a typo.
      .replace(/,\s*([,.;:])/g, "$1")
  );
}

/**
 * Drops the "X, not Y" tail the model keeps reaching for.
 *
 * It writes "these are best used as visual reference only, not as a foundation
 * to build on" and "this needs to be addressed in the design phase, not after".
 * The first half already says it. The tail argues with a position nobody took,
 * which reads as defensive in a document a client is reading.
 *
 * Only the trailing clause goes, and only where the sentence still stands
 * without it: "visual reference only" carries the point on its own, as does
 * "in the design phase".
 *
 * Deliberately not applied to terms, payment terms or the revisions policy. In
 * those, "due on delivery, not on acceptance" is the whole point of the
 * sentence, and cutting it would quietly change what the freelancer is
 * agreeing to. Use this on prose, and let the prompt handle the rest.
 */
export function stripContrastive(text: string): string {
  return (
    text
      // ", not as a foundation to build on." / ", rather than after."
      .replace(/,\s+(?:not|rather than)\s+[^.;!?]*(?=[.;!?]|$)/gi, "")
      // A sentence that was only the contrast leaves a dangling space.
      .replace(/\s+([.;!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

export function sanitizeText(text: string): string {
  // \x00-\x08, \x0B-\x0C, \x0E-\x1F: the C0 controls, minus tab (\x09),
  // newline (\x0A) and carriage return (\x0D).
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}
