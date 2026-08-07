/**
 * Parses the freeform timeline string the model returns into structured
 * stages, so every surface (brief view, public quote page, PDF) can render
 * the same roadmap graphic and the same bullet list from one parse.
 *
 * The prompt asks for "Week 1-2: Label - what actually happens", one stage
 * per line, but this stays forgiving: older quotes were generated under a
 * looser prompt, and a client-facing page should never render worse because
 * a model dropped a dash.
 */
export interface TimelineStage {
  /** The timing, e.g. "Week 1-2". Empty when a line has no explicit range. */
  period: string;
  /** Short stage name, e.g. "Discovery & audit". */
  label: string;
  /** The specifics, when the line includes them. Often empty on older quotes. */
  detail: string;
}

/** Splits the raw string into one entry per stage, tolerating the several
 * shapes the model has produced over time. */
function splitStages(timeline: string): string[] {
  const clean = (s: string) => s.replace(/^[-•·*]\s*/, "").trim();

  let stages = timeline.split("\n").map(clean).filter(Boolean);
  if (stages.length >= 2) return stages;

  // Single line: fall back to splitting on "Week N" style boundaries, then
  // on semicolons, before giving up and treating it as one stage.
  stages = timeline
    .split(/(?=(?:Weeks?|Months?|Phase|Days?|Stage)\s+\d)/i)
    .map(clean)
    .filter(Boolean);
  if (stages.length >= 2) return stages;

  return timeline.split(";").map(clean).filter(Boolean);
}

export function parseTimelineStages(timeline: string): TimelineStage[] {
  if (!timeline?.trim()) return [];

  return splitStages(timeline).map((line) => {
    // "Week 1-2: Design - wireframes then visuals"
    const colon = line.indexOf(":");
    const hasPeriod = colon > -1 && /\d/.test(line.slice(0, colon));
    const period = hasPeriod ? line.slice(0, colon).trim() : "";
    const rest = hasPeriod ? line.slice(colon + 1).trim() : line;

    // Split label from detail on the first " - " (or en/em dash), leaving
    // hyphenated words like "end-to-end" alone.
    const dash = rest.match(/\s+[-–—]\s+/);
    if (dash?.index !== undefined) {
      return {
        period,
        label: rest.slice(0, dash.index).trim(),
        detail: rest.slice(dash.index + dash[0].length).trim(),
      };
    }
    return { period, label: rest, detail: "" };
  });
}

/** Whether there's enough structure to be worth drawing a roadmap, rather
 * than just printing the sentence. Very long stage labels make the graphic
 * unreadable, so those fall back to plain text too. */
export function isRoadmapWorthy(stages: TimelineStage[]): boolean {
  return stages.length >= 2 && stages.every((s) => (s.period || s.label).length <= 60);
}

/** The short caption under each dot on the roadmap graphic: the timing if we
 * have it, otherwise the stage name. */
export function stageTick(stage: TimelineStage): string {
  return stage.period || stage.label;
}
