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

  it("leaves the freelancer's own payment terms in charge", () => {
    // The "invoiced on completion" line only appears when they have not
    // written terms of their own: those are their words and they win.
    expect(templates).toContain("brief.extras?.paymentTerms ? undefined");
    expect(pdf).toContain("brief.extras?.paymentTerms ? undefined");
  });

  it("carries the version through to both renderers", () => {
    expect(readFileSync("src/app/q/[slug]/page.tsx", "utf8")).toContain("layoutOf(brief.settings)");
    expect(readFileSync("src/app/api/briefs/[id]/pdf/route.ts", "utf8")).toContain(
      "layoutOf(brief.settings)"
    );
  });
});
