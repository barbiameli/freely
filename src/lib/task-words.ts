/**
 * A task is the length of a card, not a paragraph.
 *
 * The breakdown once allowed up to ten steps written as sentences, so a
 * deliverable arrived as a column of lines like "Audit the existing type
 * styles and list every size in use". On a board that is unreadable: the eye
 * wants a label, and a card that has to be read twice is worse than a card
 * that says less.
 *
 * The first fix cut everything to four words, which was too blunt in the
 * other direction. "Sketch flows for both journeys" is a good card and a
 * four-word cap turns it into "Sketch flows for both". The ceiling is now
 * eight, which is roughly where a label stops being scannable, and the cut
 * prefers a clause boundary so the result is never a half-thought.
 *
 * The prompt asks for this. This is what catches the times it does not, and
 * the freelancer is the one looking at the result.
 */

/** Trailing punctuation a label should not carry. */
const TRAILING = /[.,;:!?\s]+$/;

/** Longest a card can be before it stops being scannable. */
export const MAX_TASK_WORDS = 8;

function tidy(text: string): string {
  return text.trim().replace(TRAILING, "").trim();
}

/**
 * The step as a card.
 *
 * Left alone when it is already short enough, which is the common case now
 * that the prompt asks for it. Only a genuinely long one gets cut, and then
 * at a clause boundary where there is one, because "Audit type styles,
 * listing every size in use" has a good label in front of it and truncating
 * on word count alone would leave "Audit type styles, listing every size in".
 */
export function taskLabel(text: string, maxWords = MAX_TASK_WORDS): string {
  const whole = tidy(text);
  if (!whole) return "";

  // A spaced dash is label-then-explanation, whatever the length: "Annotate
  // all frames - behaviour and edge cases" is a card with a footnote glued to
  // it. Cut those always. A comma is different, since plenty of good short
  // labels contain one, so that only gives way when the line is too long.
  const beforeDash = tidy(whole.split(/\s+[-–—]\s+/)[0] ?? "");
  const base = beforeDash || whole;
  if (base.split(/\s+/).length <= maxWords) return base;

  const firstClause = tidy(base.split(/\s*[,;:]\s/)[0] ?? "");
  if (firstClause && firstClause.split(/\s+/).length <= maxWords) return firstClause;

  return (firstClause || base).split(/\s+/).slice(0, maxWords).join(" ");
}

/** Whether this reads as a sentence rather than a label. */
export function tooWordy(text: string, maxWords = MAX_TASK_WORDS): boolean {
  return taskLabel(text, maxWords) !== tidy(text);
}
