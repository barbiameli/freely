import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { milestonesFromSettings } from "@/lib/milestone-lines";

/**
 * The split the client is agreeing to has to be on the document they sign.
 *
 * Milestones were rendered on the editing page and on the project tracker and
 * nowhere else. Somebody chose to be paid per milestone, watched Freely work
 * out the split, and sent a quote that said nothing about it.
 */
const MILESTONES = [
  { name: "Discovery", deliverableIndexes: [0, 1], gate: "Wireframes signed off", amount: 1500 },
  { name: "Build", deliverableIndexes: [2], amount: 3500 },
];
const DELIVERABLES = ["Audit", "Wireframes", "Front end"];

describe("reading them off a quote", () => {
  it("ignores a leftover list when the quote is not billed that way", () => {
    expect(milestonesFromSettings({ useMilestones: false, milestones: MILESTONES })).toEqual([]);
  });

  it("returns them when it is", () => {
    expect(milestonesFromSettings({ useMilestones: true, milestones: MILESTONES })).toHaveLength(2);
  });

  it("survives a quote with no settings at all", () => {
    expect(milestonesFromSettings(null)).toEqual([]);
    expect(milestonesFromSettings({ useMilestones: true })).toEqual([]);
  });
});

describe("every place a client can see the quote", () => {
  it("carries the milestones to the published page", () => {
    const page = readFileSync("src/app/q/[slug]/page.tsx", "utf8");
    expect(page).toContain("milestonesFromSettings(brief.settings)");
  });

  it("carries them to the PDF", () => {
    const route = readFileSync("src/app/api/briefs/[id]/pdf/route.ts", "utf8");
    expect(route).toContain("milestonesFromSettings(brief.settings)");
  });

  it("carries them to the preview, so the editing page shows what will be sent", () => {
    const view = readFileSync("src/app/(app)/quote/[briefId]/brief-view.tsx", "utf8");
    expect(view).toMatch(/milestones: brief\.milestones/);
  });
});
