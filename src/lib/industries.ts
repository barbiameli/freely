/**
 * Freely's onboarding asks every new user which of these ~7 broad categories
 * they work in. This is deliberately a small, fixed set — not a free-text
 * field and not 30 individual niches — so it stays easy to reason about
 * while still letting the app tailor default prompts per kind of work.
 */
export interface IndustryOption {
  key: string;
  label: string;
  /** Shown as example/placeholder text in the Quote wizard's Instructions
   * field for this category — a light nudge, not a rigid template. */
  quoteInstructionsExample: string;
}

export const INDUSTRY_OPTIONS: IndustryOption[] = [
  {
    key: "design",
    label: "Design (UX/UI, product, brand)",
    quoteInstructionsExample:
      "e.g. focus on discovery + design system audit, call out Figma handoff explicitly",
  },
  {
    key: "development",
    label: "Development (web, mobile, software)",
    quoteInstructionsExample:
      "e.g. break out frontend vs backend hours, note tech stack and hosting assumptions",
  },
  {
    key: "writing",
    label: "Writing & content",
    quoteInstructionsExample:
      "e.g. specify word count per deliverable, note revision rounds included",
  },
  {
    key: "marketing",
    label: "Marketing & growth",
    quoteInstructionsExample:
      "e.g. call out channels covered, distinguish strategy work from execution",
  },
  {
    key: "data",
    label: "Data (engineering, science, analytics, architecture)",
    quoteInstructionsExample:
      "e.g. note data sources and access needed upfront, separate pipeline/infra work from analysis or modeling",
  },
  {
    key: "consulting",
    label: "Consulting & strategy",
    quoteInstructionsExample:
      "e.g. frame around a workshop + written recommendations structure",
  },
  {
    key: "other",
    label: "Something else",
    quoteInstructionsExample: "e.g. describe the shape of the engagement in your own words",
  },
];

export function industryLabel(key: string | null | undefined): string {
  return INDUSTRY_OPTIONS.find((i) => i.key === key)?.label ?? "Freelancer";
}

export function industryQuoteExample(key: string | null | undefined): string {
  return (
    INDUSTRY_OPTIONS.find((i) => i.key === key)?.quoteInstructionsExample ??
    "e.g. focus on discovery phase, keep it generic enough to reuse..."
  );
}
