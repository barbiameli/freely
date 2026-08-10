import { parseTimelineStages, isRoadmapWorthy, stageTick } from "@/lib/timeline";

/**
 * Renders a timeline as a small roadmap graphic with the stages spelled out
 * underneath it. Both, deliberately: the graphic gives the shape of the
 * project at a glance, and the bullets carry the detail a client needs to
 * actually agree to it. Used by the brief view and the public quote page, so
 * the two can't drift apart.
 *
 * Falls back to plain text when the string has no usable structure, which is
 * the case for quotes generated before the prompt asked for staged output.
 */
export function TimelineView({
  timeline,
  accent,
  muted,
  className,
}: {
  timeline: string;
  /** Colour for the rule and dots. Defaults to the app's violet. */
  accent?: string;
  /** Colour for secondary text. Defaults to the app's slate. */
  muted?: string;
  className?: string;
}) {
  const stages = parseTimelineStages(timeline);
  const dot = accent || "#6320EE";
  const subtle = muted || "#565656";

  if (!isRoadmapWorthy(stages)) {
    return <p className={`text-sm m-0 ${className || ""}`}>{timeline}</p>;
  }

  return (
    <div className={className}>
      <div aria-hidden className="mb-5">
        <div className="h-[2px] w-full rounded-full" style={{ background: dot, opacity: 0.25 }} />
        <div className="flex -mt-[5px]">
          {stages.map((stage, i) => (
            <div key={i} className="flex-1 flex flex-col items-center px-1 text-center">
              <div className="w-2 h-2 rounded-full mb-1.5" style={{ background: dot }} />
              <span className="text-caption leading-tight" style={{ color: subtle }}>
                {stageTick(stage)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {stages.map((stage, i) => (
          <div key={i} className="text-body leading-relaxed">
            <span className="font-bold">
              {stage.period ? `${stage.period}: ` : ""}
              {stage.label}
            </span>
            {stage.detail && <span style={{ color: subtle }}> {stage.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
