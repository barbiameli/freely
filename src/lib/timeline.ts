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

/** A period parsed into numbers, so a set of stages can be added up. */
export interface StageRange {
  unit: "day" | "week" | "month";
  from: number;
  to: number;
}

const UNIT_WORDS: [RegExp, StageRange["unit"]][] = [
  [/\bdays?\b/i, "day"],
  [/\bweeks?\b/i, "week"],
  [/\bmonths?\b/i, "month"],
];

/**
 * "Week 2-3" as numbers, or nothing.
 *
 * Deliberately narrow. A period it cannot read means no total gets stated,
 * which is the honest outcome: a wrong total on a document somebody signs is
 * worse than no total.
 */
export function parseStageRange(period: string): StageRange | null {
  if (!period) return null;
  const unit = UNIT_WORDS.find(([pattern]) => pattern.test(period))?.[1];
  if (!unit) return null;
  const numbers = Array.from(period.matchAll(/\d+/g)).map((m) => Number(m[0]));
  if (numbers.length === 0) return null;
  const from = numbers[0];
  const to = numbers.length > 1 ? numbers[numbers.length - 1] : from;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return { unit, from, to };
}

/**
 * How long the whole thing runs.
 *
 * A client asked how long a project was because two stages were both labelled
 * "Week 2" and nothing anywhere added them up. Every stage carried its own
 * timing and the document never stated the one number the client actually
 * needed. So it is computed from the stages rather than asked of the model,
 * which cannot be trusted to add up its own bullets.
 *
 * Stages sharing a period are concurrent, and concurrent work does not extend
 * a project, so this is the furthest point reached rather than a sum.
 */
export function timelineSpan(stages: TimelineStage[]): StageRange | null {
  const ranges = stages.map((s) => parseStageRange(s.period)).filter((r): r is StageRange => !!r);
  if (ranges.length === 0) return null;

  // Mixed units are a quote nobody should be adding up automatically.
  const unit = ranges[0].unit;
  if (ranges.some((r) => r.unit !== unit)) return null;

  return {
    unit,
    from: Math.min(...ranges.map((r) => r.from)),
    to: Math.max(...ranges.map((r) => r.to)),
  };
}

/** The sentence, in the quote's language. Empty when there is no honest one. */
export function timelineTotal(
  timeline: string,
  words: { totalWeeks: string; totalDays: string; totalMonths: string; concurrent: string }
): string {
  const stages = parseTimelineStages(timeline);
  const span = timelineSpan(stages);
  if (!span) return "";

  const length = span.to - span.from + 1;
  if (length < 1) return "";
  const template =
    span.unit === "day" ? words.totalDays : span.unit === "month" ? words.totalMonths : words.totalWeeks;
  const total = template.replace("{count}", String(length));

  // Said out loud, because two bullets carrying the same week is exactly what
  // made a client ask whether the project was two weeks long.
  const periods = stages.map((s) => s.period).filter(Boolean);
  const overlapping = periods.length !== new Set(periods).size;
  return overlapping ? `${total} ${words.concurrent}` : total;
}

/**
 * One tick per distinct period.
 *
 * Two stages in the same week used to draw two dots side by side with the
 * same caption under both, which reads as two weeks.
 */
export function roadmapTicks(stages: TimelineStage[]): string[] {
  const ticks: string[] = [];
  for (const stage of stages) {
    const tick = stageTick(stage);
    if (tick && ticks[ticks.length - 1] !== tick) ticks.push(tick);
  }
  return ticks;
}
