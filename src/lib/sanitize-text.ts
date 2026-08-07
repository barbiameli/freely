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
export function sanitizeText(text: string): string {
  // \x00-\x08, \x0B-\x0C, \x0E-\x1F: the C0 controls, minus tab (\x09),
  // newline (\x0A) and carriage return (\x0D).
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}
