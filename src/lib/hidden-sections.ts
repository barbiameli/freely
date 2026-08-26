import type { Strategy, BriefExtras } from "@/lib/anthropic";

/**
 * The sections a finished quote can have taken out of it.
 *
 * Scope, deliverables and the price are not here. A quote without them is not
 * a shorter quote, it is a different document, and there is no version of
 * "send this" that makes sense without them.
 *
 * Milestones are not here either: the split is stored on the project, not on
 * the public quote, so there is nothing on the client's page to take out.
 */
export type HideableSection =
  | "strategy"
  | "timeline"
  | "paymentTerms"
  | "revisions"
  | "availability"
  | "aiUsage"
  | "terms";

export const HIDEABLE_SECTIONS: HideableSection[] = [
  "strategy",
  "timeline",
  "paymentTerms",
  "revisions",
  "availability",
  "aiUsage",
  "terms",
];

export function isHideable(value: string): value is HideableSection {
  return (HIDEABLE_SECTIONS as string[]).includes(value);
}

/** The shape this needs off a quote. Narrow on purpose, so the same function
 * serves the public page and the preview without either one importing the
 * other's types. */
interface Hideable {
  strategy: Strategy | null;
  timeline: string;
  extras?: BriefExtras | null;
}

/**
 * Strips the removed sections out of a quote on its way to being rendered.
 *
 * One function, called on both the public page and the preview, because a
 * removed section that still reaches the client would be the worst possible
 * failure here: the freelancer would have watched it disappear.
 *
 * Nothing is deleted. The stored content is untouched and this only decides
 * what is handed to the template, so putting a section back is one press.
 */
export function applyHiddenSections<T extends Hideable>(brief: T, hidden: string[]): T {
  if (hidden.length === 0) return brief;
  const off = new Set(hidden);
  const extras = brief.extras ? { ...brief.extras } : brief.extras;
  if (extras) {
    if (off.has("paymentTerms")) delete extras.paymentTerms;
    if (off.has("revisions")) delete extras.revisions;
    if (off.has("availability")) delete extras.availability;
    if (off.has("aiUsage")) delete extras.aiUsage;
    if (off.has("terms")) delete extras.terms;
  }
  return {
    ...brief,
    strategy: off.has("strategy") ? null : brief.strategy,
    timeline: off.has("timeline") ? "" : brief.timeline,
    extras,
  };
}
