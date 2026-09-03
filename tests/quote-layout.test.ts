import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  CURRENT_LAYOUT,
  groupsByMilestone,
  layoutOf,
  milestonesAreBillable,
  showsMilestoneSection,
} from "@/lib/quote-layout";
import { milestoneLines } from "@/lib/milestone-lines";
import { milestonesFromSettings } from "@/lib/milestone-lines";

/**
 * A quote a client already has must not change shape.
 *
 * It lives at a URL somebody has been sent. They may open it again in three
 * weeks to check what they agreed to, and finding a different document there
 * is not a redesign, it is a contract changing itself. So the layout is pinned
 * when the quote is written and read back off the quote.
 */
describe("the layout is pinned to the quote", () => {
  it("treats everything written before this as version 1", () => {
    expect(layoutOf(null)).toBe(1);
    expect(layoutOf({})).toBe(1);
    expect(layoutOf({ includeSOW: true })).toBe(1);
  });

  it("reads back the version a quote was written for", () => {
    expect(layoutOf({ layout: 2 })).toBe(2);
  });

  it("refuses a version it does not know rather than guessing forwards", () => {
    expect(layoutOf({ layout: 99 })).toBe(1);
    expect(layoutOf({ layout: "2" })).toBe(1);
  });

  it("stamps new quotes with the current one", () => {
    const actions = readFileSync("src/actions/briefs.ts", "utf8");
    expect(actions).toContain("layout: CURRENT_LAYOUT");
    expect(CURRENT_LAYOUT).toBe(3);
  });

  it("never rewrites the stamp on an existing quote", () => {
    const actions = readFileSync("src/actions/briefs.ts", "utf8");
    // One place sets it: the create. A refine, an edit, a publish or a section
    // toggle must not touch it.
    expect(actions.match(/layout: CURRENT_LAYOUT/g)?.length).toBe(1);
  });
});

describe("grouping deliverables under milestones", () => {
  it("needs both the layout and the milestones", () => {
    expect(groupsByMilestone({ layout: 2 }, 3)).toBe(true);
    expect(groupsByMilestone({ layout: 2 }, 0)).toBe(false);
    expect(groupsByMilestone({ layout: 1 }, 3)).toBe(false);
    expect(groupsByMilestone(null, 3)).toBe(false);
  });

  it("ignores a leftover milestone list from a plan that changed", () => {
    const settings = { layout: 2, useMilestones: false, milestones: [{ name: "One" }] };
    expect(groupsByMilestone(settings, milestonesFromSettings(settings).length)).toBe(false);
  });
});

describe("the page and the file agree", () => {
  const templates = readFileSync("src/app/q/[slug]/templates.tsx", "utf8");
  const pdf = readFileSync("src/lib/pdf.tsx", "utf8");

  it("asks the same question in both", () => {
    expect(templates).toContain("groupsByMilestone");
    expect(pdf).toContain("groupsByMilestone");
  });

  it("groups in all four web templates", () => {
    expect((templates.match(/deliverableRows\(brief\)/g) ?? []).length).toBe(4);
  });

  it("groups in all four PDF templates", () => {
    expect((pdf.match(/<PdfDeliverables/g) ?? []).length).toBe(4);
  });

  it("groups through one shared function rather than two copies of the rule", () => {
    // The rule used to be written out in both files. Two implementations of
    // "which deliverable belongs to which milestone" is how a client ends up
    // reading one agreement and printing another.
    expect(templates).toContain("groupDeliverables(");
    expect(pdf).toContain("groupDeliverables(");
    expect(templates).not.toContain("const covered = new Set");
    expect(pdf).not.toContain("const covered = new Set");
  });

  it("passes the freelancer's own payment terms in, so they outrank the default", () => {
    expect(templates).toContain("paymentTerms: brief.extras?.paymentTerms");
    expect(pdf).toContain("paymentTerms: brief.extras?.paymentTerms");
  });

  it("carries the version through to both renderers", () => {
    expect(readFileSync("src/app/q/[slug]/page.tsx", "utf8")).toContain("layoutOf(brief.settings)");
    expect(readFileSync("src/app/api/briefs/[id]/pdf/route.ts", "utf8")).toContain(
      "layoutOf(brief.settings)"
    );
  });
});


import { groupDeliverables } from "@/lib/milestone-lines";

const WORDS = { invoicedAtEnd: "Invoiced on completion", alsoIncluded: "Also included" };
const DELIVERABLES = ["Audit", "Wireframes", "Front end", "Handover"];
const MILESTONES = [
  { name: "Discovery", deliverableIndexes: [0, 1], amount: 1500 },
  { name: "Build", deliverableIndexes: [2], amount: 3500 },
];

function group(over: Partial<Parameters<typeof groupDeliverables>[0]> = {}) {
  return groupDeliverables({
    milestones: MILESTONES,
    deliverables: DELIVERABLES,
    currency: "GBP",
    language: "en",
    grouped: true,
    words: WORDS,
    ...over,
  });
}

/**
 * One grouping, used by the page and by the PDF.
 *
 * They are the same document in two files. Writing the rule twice is how a
 * client ends up reading one agreement and printing a different one.
 */
describe("grouping the deliverables", () => {
  it("says no when the quote is not grouped, so the flat list renders", () => {
    expect(group({ grouped: false })).toBeNull();
    expect(group({ milestones: [] })).toBeNull();
    expect(group({ milestones: undefined })).toBeNull();
  });

  it("puts each deliverable under the milestone that pays for it", () => {
    const groups = group()!;
    expect(groups[0].name).toBe("Discovery");
    expect(groups[0].items).toEqual([0, 1]);
    expect(groups[1].items).toEqual([2]);
  });

  it("gives the leftovers a group rather than dropping them", () => {
    const groups = group()!;
    expect(groups.at(-1)?.name).toBe("Also included");
    expect(groups.at(-1)?.items).toEqual([3]);
  });

  it("adds no leftover group when the milestones cover everything", () => {
    const groups = group({
      milestones: [{ name: "All of it", deliverableIndexes: [0, 1, 2, 3], amount: 5000 }],
    })!;
    expect(groups).toHaveLength(1);
  });

  it("never lists the same deliverable twice", () => {
    const groups = group({
      milestones: [
        { name: "One", deliverableIndexes: [0, 0, 1], amount: 100 },
        { name: "Two", deliverableIndexes: [1, 2], amount: 100 },
      ],
    })!;
    expect(groups[0].items).toEqual([0, 1]);
    expect(groups[1].items).toEqual([2]);
  });

  it("survives a milestone pointing at a deliverable that was deleted", () => {
    const groups = group({
      milestones: [{ name: "Ghost", deliverableIndexes: [9, 0], amount: 100 }],
    })!;
    expect(groups[0].items).toEqual([0]);
  });

  it("survives a milestone that covers nothing at all", () => {
    const groups = group({
      milestones: [{ name: "Empty", deliverableIndexes: [], amount: 0 }],
    })!;
    expect(groups[0].items).toEqual([]);
    expect(groups.at(-1)?.name).toBe("Also included");
  });

  it("writes the amount with its currency", () => {
    expect(group()![0].amount).toContain("£");
    expect(group({ currency: "EUR", language: "es" })![0].amount).toContain("€");
  });

  it("drops the default note when the freelancer wrote their own terms", () => {
    expect(group()![0].note).toBe("Invoiced on completion");
    expect(group({ paymentTerms: "Half up front." })![0].note).toBeUndefined();
  });

  it("leaves the catch-all group without an amount", () => {
    expect(group()!.at(-1)?.amount).toBe("");
  });
});


/**
 * Version 3: stages are their own section.
 *
 * A client read a real quote and could not find the milestones, because they
 * only existed as headings inside the deliverables list and read as
 * deliverables. They are different things, and the money question is a third
 * thing again.
 */
describe("stages are not deliverables", () => {
  it("gives them a section of their own from version 3", () => {
    expect(showsMilestoneSection({ layout: 3 }, 2)).toBe(true);
    expect(showsMilestoneSection({ layout: 2 }, 2)).toBe(false);
    expect(showsMilestoneSection({ layout: 1 }, 2)).toBe(false);
  });

  it("says nothing when there are no stages", () => {
    expect(showsMilestoneSection({ layout: 3 }, 0)).toBe(false);
  });

  it("stops folding them into the deliverables from version 3", () => {
    // Version 2 quotes keep the shape they were sent in.
    expect(groupsByMilestone({ layout: 2 }, 2)).toBe(true);
    expect(groupsByMilestone({ layout: 3 }, 2)).toBe(false);
  });

  it("only puts money on a stage when the freelancer said so", () => {
    expect(milestonesAreBillable({ layout: 3, milestonesBillable: true })).toBe(true);
    expect(milestonesAreBillable({ layout: 3, milestonesBillable: false })).toBe(false);
  });

  it("treats every quote written before the distinction as billed by stage", () => {
    // Those could only have been created under a payment plan that meant it.
    expect(milestonesAreBillable({ layout: 2 })).toBe(true);
    expect(milestonesAreBillable(null)).toBe(true);
  });

  it("does not turn keeping stages into a decision about money", () => {
    const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");
    expect(wizard).toContain("choices.milestonesBillable && choices.milestones.length > 1");
  });
});

describe("what a stage renders as", () => {
  const milestones = [
    { name: "Review and interviews", deliverableIndexes: [0], gate: "Findings agreed", amount: 300 },
    { name: "Redesign", deliverableIndexes: [1, 2], gate: "", amount: 350 },
  ];
  const deliverables = [
    "Flow review doc - a written breakdown of the two flows",
    "Redesigned screens - Figma frames for both flows",
    "Annotations - inline notes on the frames",
  ];

  it("names what lands in each, in short form", () => {
    const lines = milestoneLines({ milestones, deliverables, currency: "USD", billable: true });
    expect(lines[1].delivers).toEqual(["Redesigned screens", "Annotations"]);
  });

  it("shows an amount only when the stages are payment points", () => {
    const billed = milestoneLines({ milestones, deliverables, currency: "USD", billable: true });
    expect(billed[0].amount).toContain("300");

    const shape = milestoneLines({ milestones, deliverables, currency: "USD", billable: false });
    expect(shape[0].amount).toBe("");
    expect(shape[0].name).toBe("Review and interviews");
  });

  it("carries the gate through, where there is one", () => {
    const lines = milestoneLines({ milestones, deliverables, currency: "USD", billable: true });
    expect(lines[0].gate).toBe("Findings agreed");
    expect(lines[1].gate).toBe("");
  });

  it("says nothing when a quote has no stages", () => {
    expect(milestoneLines({ milestones: [], deliverables, billable: true })).toEqual([]);
    expect(milestoneLines({ milestones: undefined, deliverables, billable: true })).toEqual([]);
  });
});
