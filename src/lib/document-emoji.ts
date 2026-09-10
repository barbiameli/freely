/**
 * The emoji a document can wear.
 *
 * In its own module rather than in actions/documents, because that file is
 * marked "use server" and such a file may only export async functions. An
 * exported array there compiles and type-checks perfectly well and then fails
 * the build at page-data collection with "can only export async functions,
 * found object", which is a long way from where the mistake was made.
 *
 * A small fixed set, and only this set. Free text would be a field somebody
 * pastes a sentence into, and the column is one character wide by design.
 * These are the kinds of thing a freelancer actually sends a client.
 */
export const DOCUMENT_EMOJI = [
  "",
  "\u{1F4C4}",
  "\u{1F3A8}",
  "\u{1F5BC}️",
  "\u{1F4CA}",
  "\u{1F4DD}",
  "\u{1F510}",
  "\u{1F4C1}",
  "✅",
  "\u{1F680}",
  "✨",
  "\u{1F4CE}",
];
