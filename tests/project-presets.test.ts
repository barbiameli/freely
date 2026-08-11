import { describe, it, expect } from "vitest";
import { projectPresetKeys } from "@/lib/quote-prompts";

/**
 * The examples offered under "How should this project run?".
 *
 * They were four design examples shown to everyone, so a data scientist was
 * offered "Agree the visual direction before any design starts", which is not
 * a sentence about their job.
 */
describe("projectPresetKeys", () => {
  it("offers a designer a design sign-off", () => {
    expect(projectPresetKeys("ux-designer")[0]).toBe("presetSignOffDesign");
    expect(projectPresetKeys("brand-designer")[0]).toBe("presetSignOffDesign");
  });

  it("offers a data scientist something about data, not visual direction", () => {
    const keys = projectPresetKeys("data-scientist");
    expect(keys[0]).toBe("presetSignOffData");
    expect(keys).not.toContain("presetSignOffDesign");
  });

  it("offers a developer something about the stack", () => {
    expect(projectPresetKeys("backend-developer")[0]).toBe("presetSignOffBuild");
    expect(projectPresetKeys("mobile-developer")[0]).toBe("presetSignOffBuild");
  });

  it("offers a writer something about the angle", () => {
    expect(projectPresetKeys("content-creator")[0]).toBe("presetSignOffWords");
  });

  it("always includes the two that are true of any project", () => {
    for (const industry of ["ux-designer", "data-engineer", "marketing", null]) {
      const keys = projectPresetKeys(industry);
      expect(keys).toContain("presetResearchFirst");
      expect(keys).toContain("presetSmallFirstPhase");
    }
  });

  it("guesses nothing for an industry it does not know", () => {
    // "other" stores whatever free text someone typed, so this is the common
    // case rather than an edge one. General examples beat a wrong guess.
    expect(projectPresetKeys("Underwater basket weaving")).toEqual([
      "presetResearchFirst",
      "presetSmallFirstPhase",
    ]);
    expect(projectPresetKeys(null)).toHaveLength(2);
  });

  it("offers no examples about money", () => {
    // Rate and payment answer those now, in one place. An example here saying
    // "price this fixed" would be a second way to set something already set.
    for (const industry of ["ux-designer", "data-scientist", null]) {
      for (const key of projectPresetKeys(industry)) {
        expect(key).not.toMatch(/price|milestone|payment/i);
      }
    }
  });
});
