import { describe, it, expect } from "vitest";
import { parseTimelineStages, isRoadmapWorthy, stageTick } from "@/lib/timeline";

describe("parseTimelineStages", () => {
  it("parses the shape the prompt asks for: period, label, detail", () => {
    const stages = parseTimelineStages(
      "Week 1-2: Discovery - stakeholder interviews and an audit of the current site\n" +
        "Week 3-4: Design - wireframes for 6 screens, then two rounds of visual design"
    );
    expect(stages).toHaveLength(2);
    expect(stages[0]).toEqual({
      period: "Week 1-2",
      label: "Discovery",
      detail: "stakeholder interviews and an audit of the current site",
    });
    expect(stages[1].period).toBe("Week 3-4");
    expect(stages[1].label).toBe("Design");
  });

  it("handles stages with no detail after the label", () => {
    const stages = parseTimelineStages("Week 1: Discovery\nWeek 2: Build");
    expect(stages).toEqual([
      { period: "Week 1", label: "Discovery", detail: "" },
      { period: "Week 2", label: "Build", detail: "" },
    ]);
  });

  it("strips bullet characters the model sometimes adds", () => {
    const stages = parseTimelineStages("- Week 1: Discovery\n• Week 2: Build");
    expect(stages.map((s) => s.label)).toEqual(["Discovery", "Build"]);
  });

  it("splits a single run-on line on week boundaries", () => {
    const stages = parseTimelineStages("Week 1-2: Discovery Week 3-4: Design Week 5: Launch");
    expect(stages).toHaveLength(3);
    expect(stages[2].period).toBe("Week 5");
  });

  it("falls back to semicolons when there are no week markers", () => {
    const stages = parseTimelineStages("Kickoff; Design; Handover");
    expect(stages.map((s) => s.label)).toEqual(["Kickoff", "Design", "Handover"]);
  });

  it("leaves hyphenated words intact when splitting label from detail", () => {
    const [stage] = parseTimelineStages("Week 1: End-to-end audit - covers the full funnel");
    expect(stage.label).toBe("End-to-end audit");
    expect(stage.detail).toBe("covers the full funnel");
  });

  it("treats a colon with no digits before it as part of the text, not a period", () => {
    const [stage] = parseTimelineStages("Note: this is a single vague sentence");
    expect(stage.period).toBe("");
    expect(stage.label).toBe("Note: this is a single vague sentence");
  });

  it("returns nothing for empty input", () => {
    expect(parseTimelineStages("")).toEqual([]);
    expect(parseTimelineStages("   ")).toEqual([]);
  });
});

describe("isRoadmapWorthy", () => {
  it("needs at least two stages", () => {
    expect(isRoadmapWorthy(parseTimelineStages("Week 1: Discovery"))).toBe(false);
    expect(isRoadmapWorthy(parseTimelineStages("Week 1: Discovery\nWeek 2: Build"))).toBe(true);
  });

  it("refuses stages too long to fit under a dot", () => {
    const long = `Week 1: ${"a".repeat(80)}\nWeek 2: Build`;
    expect(isRoadmapWorthy(parseTimelineStages(long))).toBe(true);
    const noPeriod = `${"a".repeat(80)}\n${"b".repeat(80)}`;
    expect(isRoadmapWorthy(parseTimelineStages(noPeriod))).toBe(false);
  });
});

describe("stageTick", () => {
  it("prefers the period, falling back to the label", () => {
    expect(stageTick({ period: "Week 1-2", label: "Discovery", detail: "" })).toBe("Week 1-2");
    expect(stageTick({ period: "", label: "Discovery", detail: "" })).toBe("Discovery");
  });
});
