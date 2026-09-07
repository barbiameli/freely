/**
 * A task is the length of a card.
 *
 * The breakdown allowed up to ten steps and each was written as a sentence,
 * so a deliverable arrived as a column of lines like "Audit the existing type
 * styles and list every size in use". On a board that is unreadable: the eye
 * needs a label, not a paragraph, and a card that has to be read twice is
 * worse than a card that says less.
 *
 * The prompt asks for two to four words. This is what catches the times it
 * does not, because a model told to be brief is brief most of the time and
 * the freelancer is the one looking at the result.
 */

/** Trailing punctuation a label should not carry. */
const TRAILING = /[.,;:!?\s]+$/;

/**
 * The first clause, cut to a card.
 *
 * Cuts at the first comma or dash rather than simply truncating, because
 * "Audit type styles, listing every size in use" has a good label in front of
 * it and chopping at a word count would leave "Audit type styles, listing".
 */
export function taskLabel(text: string, maxWords = 4): string {
  const firstClause = text.trim().split(/\s*[,;:]\s|\s+[-–—]\s+/)[0] ?? "";
  const cleaned = firstClause.replace(TRAILING, "").trim();
  if (!cleaned) return text.trim().replace(TRAILING, "");

  const words = cleaned.split(/\s+/);
  if (words.length <= maxWords) return cleaned;
  return words.slice(0, maxWords).join(" ");
}

/** Whether this reads as a sentence rather than a label. */
export function tooWordy(text: string, maxWords = 4): boolean {
  return taskLabel(text, maxWords) !== text.trim().replace(TRAILING, "");
}
