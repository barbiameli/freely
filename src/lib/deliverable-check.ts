/**
 * Whether a line on a quote is a thing or a happening.
 *
 * A deliverable is a noun the client ends up holding: a file, a document, a
 * set of screens, a corrected version of one of those. A round of revisions is
 * not, and the test that separates them is whether it would exist if the
 * client said nothing back. If it only happens because they responded, it
 * cannot be promised as an item being bought, because there may be no
 * response and then there is nothing to hand over.
 *
 * A real quote listed "Design review session" and "Feedback-incorporated final
 * Figma files" as deliverables seven and nine, and the client wrote back
 * asking whether that was one round of revisions or two. He was right to ask.
 *
 * The prompt says all of this, and this catches it when the prompt is ignored.
 * A model told not to do something will still do it occasionally, and the
 * freelancer is the one who sends the result.
 */

/**
 * Words for a happening rather than a thing.
 *
 * Matched as whole words so "workshop materials" survives: the materials are
 * an artifact, the workshop is not, and the difference is what the line is
 * actually offering.
 */
const HAPPENINGS = [
  "revision",
  "revisions",
  "amend",
  "amends",
  "iteration",
  "iterations",
  "feedback",
  "review",
  "walkthrough",
  "call",
  "calls",
  "session",
  "sessions",
  "workshop",
  "meeting",
  "meetings",
  "check-in",
  "handover",
  "kickoff",
  // Spanish, since a quote is written in the language it will be read in.
  "revisión",
  "revisiones",
  "ronda",
  "rondas",
  "llamada",
  "llamadas",
  "reunión",
  "reuniones",
  "sesión",
  "sesiones",
];

/**
 * Words that turn a happening back into a thing.
 *
 * "Workshop materials" and "review notes" are artifacts: somebody is handed
 * them. Without this the check would flag half the honest lines on a research
 * quote, and a check that cries wolf is one people turn off.
 */
const ARTIFACTS = [
  "notes",
  "document",
  "doc",
  "deck",
  "slides",
  "report",
  "summary",
  "materials",
  "guide",
  "file",
  "files",
  "recording",
  "transcript",
  "notas",
  "documento",
  "informe",
  "resumen",
  "guía",
  "archivo",
  "archivos",
];

function words(text: string): string[] {
  // Split on anything that is not a letter, a digit or a hyphen. Written out
  // rather than with a Unicode property escape, which this target does not
  // support, and accented letters have to survive for the Spanish list.
  return text
    .toLowerCase()
    .split(/[^0-9a-zà-öø-ÿ-]+/)
    .filter(Boolean);
}

/**
 * Whether this line describes something that happens rather than something
 * handed over.
 *
 * Only the part before the dash is read. The prompt asks for "Name - what it
 * is", and the description almost always mentions the review that produced the
 * artifact, which is not the same as the line being a review.
 */
export function isHappening(deliverable: string): boolean {
  const lead = deliverable.split(/\s+[-–—]\s+/)[0];
  const found = words(lead);
  if (found.length === 0) return false;
  if (found.some((word) => ARTIFACTS.includes(word))) return false;
  return found.some((word) => HAPPENINGS.includes(word));
}

/** The lines worth questioning, with their positions. */
export function happenings(deliverables: string[]): { index: number; text: string }[] {
  return deliverables
    .map((text, index) => ({ index, text }))
    .filter((item) => isHappening(item.text));
}

/**
 * A label that names where something sits, rather than what it is.
 *
 * "Milestone 1", "Phase 2", "Week 1", "End of Week 2" and their Spanish
 * equivalents. None of them is the name of a thing being handed over, and all
 * of them turn up at the front of deliverables written by a model that has
 * just been asked to produce milestones.
 */
const POSITION_LABEL =
  /^(?:(?:the\s+)?(?:end\s+of\s+)?(?:milestone|phase|stage|sprint|week|day|hito|fase|etapa|semana|día|dia)\s*\d*|fin(?:al)?\s+de\s+(?:la\s+)?semana\s*\d*)\s*$/i;

/** Whether this is a position rather than a name. */
export function isPositionLabel(text: string): boolean {
  return POSITION_LABEL.test(text.trim().replace(/[:,\-–—]\s*$/, ""));
}

/**
 * A deliverable without the scaffolding in front of it.
 *
 * A real quote listed six deliverables whose names read "Milestone 1",
 * "Milestone 1", "Milestone 1", "Milestone 2", "Milestone 2", "Milestone 2",
 * because each string had been written as "Milestone 1: End of Week 1: Flow
 * review doc covering...". Which milestone something belongs to and when it
 * lands are both already on the milestone; repeating them here cost the reader
 * the only part that says what they are getting.
 *
 * Stripped at render as well as forbidden in the prompt, so quotes written
 * before this read correctly too.
 */
export function withoutPositionPrefix(text: string): string {
  let out = text.trim();
  // Repeatedly, since "Milestone 1: End of Week 1: ..." carries two.
  for (let pass = 0; pass < 3; pass += 1) {
    const match = out.match(/^([^:]{1,24}):\s*([\s\S]+)$/);
    if (!match || !isPositionLabel(match[1])) break;
    out = match[2].trim();
  }
  return out;
}
