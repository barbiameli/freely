/**
 * Freely's onboarding asks every new user which of these roles they work in.
 * Deliberately granular (individual pills per role rather than broad
 * buckets like "Design" or "Data") so a data engineer, a UX designer, and a
 * product designer each get their own, more relevant default prompt instead
 * of all landing in the same catch-all category. "other" is the escape
 * valve for anything not listed — the onboarding UI collects free text for
 * it and stores that text directly as the industry value, rather than the
 * literal key "other".
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
    key: "ux-designer",
    label: "UX designer",
    quoteInstructionsExample: "e.g. focus on research + flows, call out usability testing explicitly",
  },
  {
    key: "product-designer",
    label: "Product designer",
    quoteInstructionsExample:
      "e.g. focus on discovery + design system audit, call out Figma handoff explicitly",
  },
  {
    key: "brand-designer",
    label: "Brand / graphic designer",
    quoteInstructionsExample: "e.g. specify number of concepts and revision rounds included",
  },
  {
    key: "frontend-developer",
    label: "Frontend developer",
    quoteInstructionsExample: "e.g. note framework/stack assumptions and browser support target",
  },
  {
    key: "backend-developer",
    label: "Backend developer",
    quoteInstructionsExample: "e.g. call out infra/hosting assumptions and third-party integrations",
  },
  {
    key: "fullstack-developer",
    label: "Full-stack developer",
    quoteInstructionsExample: "e.g. break out frontend vs backend hours, note tech stack assumptions",
  },
  {
    key: "mobile-developer",
    label: "Mobile developer",
    quoteInstructionsExample: "e.g. specify target platforms (iOS/Android) and app store submission",
  },
  {
    key: "data-engineer",
    label: "Data engineer",
    quoteInstructionsExample: "e.g. note data sources and access needed upfront, separate pipeline/infra work",
  },
  {
    key: "data-scientist",
    label: "Data scientist / analyst",
    quoteInstructionsExample: "e.g. separate exploratory analysis from modeling or dashboarding",
  },
  {
    key: "marketing",
    label: "Marketing",
    quoteInstructionsExample:
      "e.g. call out channels covered, distinguish strategy work from execution",
  },
  {
    key: "content-creator",
    label: "Content creator / writer",
    quoteInstructionsExample: "e.g. specify word count or video length per deliverable, revision rounds",
  },
  {
    key: "consultant",
    label: "Consultant / strategist",
    quoteInstructionsExample: "e.g. frame around a workshop + written recommendations structure",
  },
  {
    key: "other",
    label: "Other, please specify",
    quoteInstructionsExample: "e.g. describe the shape of the engagement in your own words",
  },
];

export function industryLabel(key: string | null | undefined): string {
  if (!key) return "Freelancer";
  return INDUSTRY_OPTIONS.find((i) => i.key === key)?.label ?? key;
}

export function industryQuoteExample(key: string | null | undefined): string {
  return (
    INDUSTRY_OPTIONS.find((i) => i.key === key)?.quoteInstructionsExample ??
    "e.g. focus on discovery phase, keep it generic enough to reuse..."
  );
}
