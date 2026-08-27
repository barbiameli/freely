import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildGenerateUserPrompt, wantsExtras, type QuoteDraftInput } from "@/lib/anthropic";

/**
 * The wait ends at the price, not at the confidentiality clause.
 *
 * A quote is written in two calls. The first carries everything a person looks
 * at first: scope, deliverables, timeline, price. The second carries the terms,
 * the revisions policy, the AI disclosure and the approach. Holding the page
 * shut until the second one lands spends somebody's attention on paragraphs
 * they have not scrolled to yet.
 */
const DRAFT: QuoteDraftInput = {
  sourceText: "A rebrand for a coffee roaster.",
  instructions: "",
  memoryProjectTitles: [],
  format: "PDF",
  hourlyRate: 65,
  rateUnit: "HOUR",
  currency: "GBP",
  paymentPlan: "SPLIT",
  upfrontPercent: 50,
  expertiseLevel: "Senior",
  includeStrategy: false,
  includeTimeline: true,
  includeSOW: true,
  includeTerms: true,
  includeRevisions: false,
  includeAvailability: false,
  includeAI: false,
};

const actions = readFileSync("src/actions/briefs.ts", "utf8");
const view = readFileSync("src/app/(app)/quote/[briefId]/brief-view.tsx", "utf8");
const anthropic = readFileSync("src/lib/anthropic.ts", "utf8");

describe("the two halves stay separate", () => {
  it("gives the core call no add-on sections to write", () => {
    const core = buildGenerateUserPrompt(DRAFT, [], undefined, "core");
    expect(core).toContain("Timeline requirements");
    expect(core).not.toContain('Include a "terms" object');
    expect(core).not.toContain('Write "paymentTerms"');
  });

  it("gives the extras call no quote to rewrite", () => {
    const extras = buildGenerateUserPrompt(DRAFT, [], undefined, "extras");
    expect(extras).toContain('Include a "terms" object');
    expect(extras).toContain("anything you add here is discarded");
  });

  it("asks for one call when there is no second half to write", () => {
    const bare: QuoteDraftInput = {
      ...DRAFT,
      includeSOW: false,
      includeTerms: false,
      includeTimeline: false,
    };
    expect(wantsExtras(bare)).toBe(false);
  });
});

describe("generating hands back as soon as the core lands", () => {
  it("splits the model calls into two exported functions", () => {
    expect(anthropic).toContain("export async function generateQuoteCore");
    expect(anthropic).toContain("export async function generateQuoteExtras");
  });

  it("waits only for the core before saving the quote", () => {
    expect(actions).toContain("generated = await generateQuoteCore(");
    expect(actions).not.toContain("generated = await generateBriefFromDraft(");
  });

  it("records that the second half is outstanding", () => {
    // "No terms" and "terms not written yet" look identical from the outside
    // and mean opposite things.
    expect(actions).toContain("extrasPending: extrasWanted");
  });

  it("stores what the second call needs to write the same quote", () => {
    for (const key of ["chooseSections,", "sectionNotes: draft.sectionNotes", "availability: draft.availability"]) {
      expect(actions, key).toContain(key);
    }
  });
});

describe("the page finishes the job", () => {
  it("asks for the rest once, not once per render", () => {
    expect(view).toContain("askedForExtras.current");
    expect(view).toContain("generateExtrasAction(brief.id)");
  });

  it("says what is happening rather than blocking the page", () => {
    expect(view).toContain("stillWriting");
    // Nothing about the quote is read-only while the rest is written: the
    // scope, the price and the deliverables are finished and editable.
    expect(view).not.toContain("readOnly={writingExtras}");
  });

  /**
   * Publishing is the exception. It puts the quote at a URL a client can open,
   * and sections landing a few seconds later would change a document somebody
   * may already be reading.
   */
  it("holds publishing until the whole document exists", () => {
    expect(view).toContain("disabled={writingExtras}");
    expect(actions).toContain("Still writing the rest of this quote");
  });

  it("keeps the quote when the second half fails", () => {
    const action = actions.slice(actions.indexOf("export async function generateExtrasAction"));
    expect(action).toContain("The quote itself is fine");
  });

  /**
   * Being rate limited is a queue, not a failure. Clearing the flag there would
   * throw away sections that were never written, permanently, over a wait of a
   * few seconds.
   */
  it("asks again later when it was only rate limited", () => {
    const action = actions.slice(actions.indexOf("export async function generateExtrasAction"));
    expect(action).toContain("retryLater = err instanceof RateLimitError");
    expect(action).toContain("extrasPending: retryLater");
    expect(action).toContain("queued behind another quote");
  });

  it("does not pay for a second call when the sections are already there", () => {
    const action = actions.slice(actions.indexOf("export async function generateExtrasAction"));
    expect(action).toContain("if (!settings.extrasPending) return { ok: true, data: { written: false } };");
  });
});
