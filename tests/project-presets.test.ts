import { describe, it, expect } from "vitest";
import { projectPresetKeys, projectPresets } from "@/lib/quote-prompts";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";

/**
 * The steers offered under "How should this project run?".
 *
 * Two things have gone wrong here before, and both are tested.
 *
 * They were four design examples shown to everyone, so a data scientist was
 * offered "Agree the visual direction before any design starts", which is not
 * a sentence about their job.
 *
 * And the chip label was the instruction itself, so a row of them rendered as
 * one run-on paragraph: "Do the discovery first and present findings before
 * scoping the restKeep the first phase small so it can be re-scoped after".
 */
describe("projectPresetKeys", () => {
  it("leads with something about the freelancer's own field", () => {
    expect(projectPresetKeys("ux-designer")[0]).toBe("presetDirectionFirst");
    expect(projectPresetKeys("backend-developer")[0]).toBe("presetStackFirst");
    expect(projectPresetKeys("data-scientist")[0]).toBe("presetDataAccess");
    expect(projectPresetKeys("content-creator")[0]).toBe("presetAngleFirst");
  });

  it("offers a data scientist nothing about visual direction", () => {
    expect(projectPresetKeys("data-scientist")).not.toContain("presetDirectionFirst");
  });

  it("always includes the three that are true of any project", () => {
    for (const industry of ["ux-designer", "data-engineer", "marketing", null]) {
      const keys = projectPresetKeys(industry);
      expect(keys).toContain("presetPhases");
      expect(keys).toContain("presetDiscovery");
      expect(keys).toContain("presetFixedScope");
    }
  });

  it("offers five to somebody whose field is known", () => {
    expect(projectPresetKeys("product-designer")).toHaveLength(5);
  });

  it("guesses nothing for an industry it does not know", () => {
    // "other" stores whatever free text someone typed, so this is the common
    // case rather than an edge one. General steers beat a wrong guess.
    expect(projectPresetKeys("Underwater basket weaving")).toEqual([
      "presetPhases",
      "presetDiscovery",
      "presetFixedScope",
    ]);
  });

  it("offers nothing about money", () => {
    // Rate and payment answer those now, in one place. A steer here saying
    // "price this fixed" would be a second way to set something already set.
    for (const industry of ["ux-designer", "data-scientist", null]) {
      for (const key of projectPresetKeys(industry)) {
        expect(key).not.toMatch(/price|milestone|payment/i);
      }
    }
  });
});

describe("the labels and the sentences are separate", () => {
  it("gives every preset both", () => {
    for (const { labelKey, textKey } of projectPresets("ux-designer")) {
      expect(en.quote[labelKey], labelKey).toBeTruthy();
      expect(en.quote[textKey], textKey).toBeTruthy();
      expect(es.quote[labelKey], labelKey).toBeTruthy();
      expect(es.quote[textKey], textKey).toBeTruthy();
    }
  });

  it("keeps every label short enough to read in a row of chips", () => {
    // Four words is a label. A clause is what made the row unreadable.
    const long: string[] = [];
    for (const industry of ["ux-designer", "backend-developer", "data-scientist", "marketing"]) {
      for (const { labelKey } of projectPresets(industry)) {
        for (const dict of [en, es]) {
          const label = dict.quote[labelKey];
          if (label.split(/\s+/).length > 4) long.push(label);
        }
      }
    }
    expect(long, "Shorten these, or move the detail into the sentence").toEqual([]);
  });

  it("writes a whole instruction into the field, not the label again", () => {
    for (const { labelKey, textKey } of projectPresets("frontend-developer")) {
      expect(en.quote[textKey]).not.toBe(en.quote[labelKey]);
      // A sentence, because it is read in a textarea rather than on a pill.
      expect(en.quote[textKey].length).toBeGreaterThan(en.quote[labelKey].length);
      expect(en.quote[textKey]).toMatch(/\.$/);
    }
  });
});
