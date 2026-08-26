"use client";

import {
  ClassicTemplate,
  EditorialTemplate,
  MinimalTemplate,
  MonoTemplate,
  type PublicBrief,
} from "@/app/q/[slug]/templates";
import { resolveBrand, type BrandSource } from "@/lib/branding";

/**
 * The quote as the client will see it.
 *
 * One function decides which template renders, used by the public page and by
 * the preview on the editing page. That is the whole point of it existing: the
 * freelancer used to edit a document laid out one way and send a document laid
 * out another, because the editing page drew its own approximation and the
 * public page drew one of three real templates. The screen where somebody
 * decides a quote is good enough to send was showing them a different quote.
 *
 * Nothing here knows about editing. It takes a finished brief and draws it,
 * which is what makes it safe to point both callers at.
 */
export function RenderedQuote({
  brief,
  branding,
  template,
  user,
}: {
  brief: PublicBrief;
  /** "freely" | "own" | "mono-light" | "mono-dark". */
  branding: string;
  /** "classic" | "editorial" | "minimal". */
  template: string;
  /** The account's saved colours and logo, for the "own" branding. */
  user: BrandSource;
}) {
  const resolved = resolveBrand(branding, user);

  if (resolved.mono) return <MonoTemplate brief={brief} dark={resolved.dark} />;

  const brand = {
    primary: resolved.primary,
    accent: resolved.accent,
    logoDataUrl: resolved.logoDataUrl,
  };

  if (template === "editorial") return <EditorialTemplate brief={brief} brand={brand} />;
  if (template === "minimal") return <MinimalTemplate brief={brief} brand={brand} />;
  return <ClassicTemplate brief={brief} brand={brand} />;
}
