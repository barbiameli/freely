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

export function sanitizeText(text: string): string {
  // \x00-\x08, \x0B-\x0C, \x0E-\x1F: the C0 controls, minus tab (\x09),
  // newline (\x0A) and carriage return (\x0D).
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}
