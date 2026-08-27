import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CURRENT_LAYOUT, layoutOf, groupsByMilestone } from "@/lib/quote-layout";
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
    expect(CURRENT_LAYOUT).toBe(2);
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
