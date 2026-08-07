export interface Preset {
  label: string;
  text: string;
}

/** Shared, one-click prompt-ready presets for every free-text Memory field —
 * used on the Memory page itself and in onboarding, so filling Memory out
 * takes a couple of clicks instead of writing paragraphs from scratch. */

export const TONE_PRESETS: Preset[] = [
  {
    label: "Professional",
    text: "Write in a professional, polished voice. Clear, confident sentences. Avoid slang and exclamation points. Lead with outcomes, not process.",
  },
  {
    label: "Startup / Techy",
    text: "Write with an energetic, startup-techy voice, punchy, modern, a little informal. Short sentences. Confident but not stiff. Fine to use words like \"ship,\" \"build,\" \"iterate.\"",
  },
  {
    label: "Relaxed",
    text: "Write in a warm, relaxed, conversational voice, like a trusted collaborator talking to a friend. Avoid corporate jargon. Contractions are fine.",
  },
  {
    label: "Corporate",
    text: "Write in a formal, corporate voice appropriate for enterprise stakeholders. Precise language, no contractions, no humor. Emphasize deliverables, timelines, and accountability.",
  },
  {
    label: "Straightforward",
    text: "Write in a plain, no-frills voice. Short, direct sentences. State facts and numbers clearly. No flourishes, no persuasive language, just the information.",
  },
  {
    label: "Warm & Reassuring",
    text: "Write in a warm, reassuring voice for clients who may be nervous about cost or scope. Acknowledge concerns before addressing them. Confident but never pushy.",
  },
];

export const INSTRUCTIONS_PRESETS: Preset[] = [
  {
    label: "Detailed & Thorough",
    text: "Spell out every deliverable and assumption explicitly. Err on the side of over-explaining scope so there's no ambiguity for the client. Call out what's NOT included as clearly as what is.",
  },
  {
    label: "Lean & Fast",
    text: "Keep the brief tight, just the essential deliverables, timeline, and price. Assume the client trusts your judgment on the details. Avoid filler or over-explaining.",
  },
  {
    label: "Client-Friendly, No Jargon",
    text: "Write for a non-technical client. Avoid design/dev jargon, explain deliverables in terms of outcomes and value, not process or tools.",
  },
  {
    label: "Premium / High-Touch",
    text: "Position this as premium, high-touch work. Emphasize craft, collaboration, and strategic thinking, not just execution. Price and hours should reflect a boutique engagement, not a commodity one.",
  },
  {
    label: "Fixed-Scope, No Surprises",
    text: "Frame everything as fixed scope for a fixed price. Be explicit about what triggers a change order versus what's included, so there's never ambiguity about extra cost.",
  },
];

export const STORY_PRESETS: Preset[] = [
  {
    label: "New independent studio",
    text: "I'm a newly independent freelancer/studio, previously in-house or at an agency. Emphasize the hands-on craft and direct access to me, no account managers, no handoffs.",
  },
  {
    label: "Established, years of experience",
    text: "I've been doing this for several years and have a track record across many client projects. Emphasize experience, process maturity, and reliability.",
  },
  {
    label: "Niche specialist",
    text: "I specialize in one specific niche rather than general work. Emphasize depth of expertise in that niche over breadth.",
  },
  {
    label: "Small team, not solo",
    text: "I work with a small team, not solo, able to take on more or move faster than a single freelancer, while staying more personal than a big agency.",
  },
];

export const CONTEXT_PRESETS: Preset[] = [
  {
    label: "Typical engagement length",
    text: "Most engagements run 4-8 weeks. Anything shorter is treated as a smaller, fixed-scope project; anything longer is usually broken into phases.",
  },
  {
    label: "Rate is firm",
    text: "My hourly rate is firm and not typically negotiated, the value is in the outcome, not the hourly number.",
  },
  {
    label: "Limited availability",
    text: "I only take on one or two new engagements per month, so availability and timeline matter as much as price in how a quote is framed.",
  },
  {
    label: "Industries I specialize in",
    text: "I mostly work with early-stage startups and small businesses rather than large enterprises, quotes should assume a lean, fast-moving client.",
  },
];
