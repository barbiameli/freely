/**
 * Does this quote's strategy object hold anything the client should see?
 *
 * The object carries two different things: an Approach written for the client
 * (goal, findings) and openQuestions, which are private notes for the
 * freelancer and never leave the app. The questions are asked for on every
 * quote, because "what is missing from this brief" is worth knowing whether or
 * not the finished document carries an Approach section.
 *
 * So the object existing no longer means there is a section to render, and
 * every render site asks this instead. Without it, a quote with Strategy
 * turned off would show the client an empty heading.
 */
export function hasStrategyContent<T extends { goal?: string; findings?: string[] }>(
  strategy?: T | null
): strategy is T {
  if (!strategy) return false;
  return Boolean(strategy.goal?.trim()) || (strategy.findings?.length ?? 0) > 0;
}
