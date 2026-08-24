import { describe, it, expect } from "vitest";
import {
  buildGenerateUserPrompt,
  wantsExtras,
  parseExtrasResponse,
  type QuoteDraftInput,
} from "@/lib/anthropic";

/**
 * The quote is written in two halves at once.
 *
 * Output tokens are produced one after another, so the length of a quote is
 * the wait. Most of that length was the add-on sections rather than the quote,
 * and none of them depend on the quote: findings come from the brief, terms
 * describe how this freelancer works, and the AI disclosure is about the kind
 * of work rather than the exact deliverable list.
 *
 * What has to stay true is that neither half writes the other's work. A core
 * prompt that still asks for terms, or an extras prompt that writes a whole
 * quote, spends the tokens the split was meant to save.
 */
const draft: QuoteDraftInput = {
  sourceText: "A rebrand for a coffee roaster, six weeks, needs a new site.",
  instructions: "",
  memoryProjectTitles: [],
  format: "PDF",
  includeSOW: true,
  includeAI: true,
  includeStrategy: true,
  includeTimeline: true,
  includeTerms: true,
  includeRevisions: true,
  includeAvailability: false,
  hourlyRate: 65,
  rateUnit: "HOUR",
  currency: "GBP",
  paymentPlan: "SPLIT",
  upfrontPercent: 50,
  expertiseLevel: "Senior",
};

describe("wantsExtras", () => {
  it("is true when any add-on section is on", () => {
    expect(wantsExtras(draft)).toBe(true);
  });

  // A bare quote is one short call and already fast. Splitting it would add a
  // round trip to something that does not need one.
  it("is false for a bare quote", () => {
    expect(
      wantsExtras({
        ...draft,
        includeSOW: false,
        includeAI: false,
        includeStrategy: false,
        includeTerms: false,
        includeRevisions: false,
        includeAvailability: false,
      })
    ).toBe(false);
  });

  // Availability is only written when there is something to write it from, so
  // the toggle alone is not a reason to make a second call.
  it("ignores availability with no facts behind it", () => {
    const bare = {
      ...draft,
      includeSOW: false,
      includeAI: false,
      includeStrategy: false,
      includeTerms: false,
      includeRevisions: false,
      includeAvailability: true,
    };
    expect(wantsExtras(bare)).toBe(false);
    expect(wantsExtras({ ...bare, availability: { facts: ["Booked until March"] } })).toBe(true);
  });
});

describe("the core half", () => {
  const core = buildGenerateUserPrompt(draft, [], undefined, "core");

  it("still asks for the quote itself", () => {
    expect(core).toMatch(/deliverables/i);
    expect(core).toMatch(/timeline/i);
  });

  it("does not ask for the sections the other call is writing", () => {
    expect(core).not.toMatch(/"strategy" object/);
    expect(core).not.toMatch(/"terms" object/);
    expect(core).not.toMatch(/"aiUsage" object/);
    expect(core).not.toMatch(/"revisions" string/);
  });

  it("keeps the pricing instruction, which only it reads", () => {
    expect(core).toMatch(/65/);
  });
});

describe("the extras half", () => {
  const extras = buildGenerateUserPrompt(draft, [], undefined, "extras");

  it("asks for the sections", () => {
    expect(extras).toMatch(/"strategy" object/);
    expect(extras).toMatch(/"terms" object/);
    expect(extras).toMatch(/"aiUsage" object/);
  });

  it("still has the brief, since the sections are written from it", () => {
    expect(extras).toMatch(/coffee roaster/);
  });

  // Without this the model helpfully writes a whole quote again, which is the
  // cost the split exists to avoid.
  it("says not to write the quote", () => {
    expect(extras).toMatch(/Return ONLY a JSON object/);
    expect(extras).toMatch(/discarded/);
  });

  it("leaves out the pricing instruction it has no use for", () => {
    expect(extras).not.toMatch(/Pricing approach/);
  });
});

describe("parseExtrasResponse", () => {
  it("reads the sections", () => {
    const parsed = parseExtrasResponse(
      JSON.stringify({ revisions: "Two rounds at wireframe and at visual design." })
    );
    expect(parsed.revisions).toBe("Two rounds at wireframe and at visual design.");
  });

  it("copes with a code fence around it", () => {
    const parsed = parseExtrasResponse('```json\n{"revisions": "Two rounds."}\n```');
    expect(parsed.revisions).toBe("Two rounds.");
  });

  // The right way round: a quote with no terms is still a quote, and throwing
  // away a generation somebody waited for because a revisions string came back
  // malformed would be the worse trade.
  it("gives up quietly rather than throwing", () => {
    expect(parseExtrasResponse("not json at all")).toEqual({});
    expect(parseExtrasResponse("")).toEqual({});
    expect(parseExtrasResponse('{"revisions": 4}')).toEqual({});
  });

  // A missing key must not arrive as undefined and blank something the core
  // produced when the two are merged.
  it("returns only the keys that actually arrived", () => {
    expect(Object.keys(parseExtrasResponse('{"revisions": "Two rounds."}'))).toEqual([
      "revisions",
    ]);
  });
});
