import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BLOCKS, blocksFromReply } from "@/lib/onboarding-blocks";

/**
 * Setting a client's page up.
 *
 * Two things are being held in place here. The screen is a wizard rather than
 * a list, because it got to five stacked panels the same way the quote form
 * once got to fourteen fields: one reasonable addition at a time. And the
 * words on it can be written from a paragraph, which means a model's reply is
 * now something that gets stored, so the shaping of that reply is worth
 * testing against the replies that go wrong.
 */
const setup = readFileSync("src/components/clients/portal-setup.tsx", "utf8");
const describeStep = readFileSync("src/components/clients/describe-step.tsx", "utf8");

describe("the setup wizard", () => {
  it("shows one step at a time", () => {
    // Every panel behind a check on the current step. A panel rendered
    // unconditionally is the long list growing back.
    const guarded = setup.match(/step === "(describe|words|sections|access)"/g) ?? [];
    expect(new Set(guarded).size).toBe(4);
  });

  it("keeps the steps to four", () => {
    const declared = setup.match(/const STEPS = \[([^\]]+)\]/);
    expect(declared).not.toBeNull();
    const names = (declared?.[1].match(/"[a-z]+"/g) ?? []).length;
    // A fifth step means one of these was split, which is worth doing on
    // purpose rather than because something new needed somewhere to go.
    expect(names).toBe(4);
  });

  it("has a way back from every step after the first", () => {
    expect(setup).toContain("t.setup.back");
    expect(setup).toContain("at > 0 &&");
  });

  it("ends at the preview", () => {
    // The last step is the only one carrying Preview and Done, so finishing
    // the wizard and looking at the result are the same movement.
    const lastBranch = setup.slice(setup.indexOf("last ? ("));
    expect(lastBranch).toContain("t.setup.preview");
    expect(lastBranch).toContain("t.setup.done");
  });

  it("saves as it goes rather than at the end", () => {
    // No Save button anywhere in the dialog: closing it halfway has to be
    // safe, or the wizard is a form with three chances to lose your work.
    expect(setup).not.toContain("t.common.save");
  });
});

describe("writing the steps from a paragraph", () => {
  it("says which kinds exist and only files under those", () => {
    const reply = JSON.stringify({
      blocks: [
        { kind: "rules", body: "Two rounds of changes at each stage." },
        { kind: "invoicing", body: "Net 30." },
      ],
    });
    expect(blocksFromReply(reply)).toEqual([
      { kind: "rules", body: "Two rounds of changes at each stage." },
    ]);
  });

  it("reads a reply that arrived wrapped in a fence", () => {
    const reply = '```json\n{"blocks":[{"kind":"comms","body":"Email is best."}]}\n```';
    expect(blocksFromReply(reply)).toEqual([{ kind: "comms", body: "Email is best." }]);
  });

  it("drops a step with nothing in it", () => {
    // A heading on a client's page with no words under it is worse than the
    // step being absent.
    const reply = JSON.stringify({
      blocks: [
        { kind: "welcome", body: "   " },
        { kind: "contract", body: "There is a contract to sign first." },
      ],
    });
    expect(blocksFromReply(reply)).toEqual([
      { kind: "contract", body: "There is a contract to sign first." },
    ]);
  });

  it("keeps the first of a kind said twice", () => {
    const reply = JSON.stringify({
      blocks: [
        { kind: "rules", body: "Two rounds." },
        { kind: "rules", body: "Three rounds." },
      ],
    });
    expect(blocksFromReply(reply)).toEqual([{ kind: "rules", body: "Two rounds." }]);
  });

  it("returns nothing rather than throwing on a reply that is not JSON", () => {
    expect(blocksFromReply("Sorry, I cannot help with that.")).toEqual([]);
    expect(blocksFromReply('{"blocks": "all of them"}')).toEqual([]);
    expect(blocksFromReply("")).toEqual([]);
  });

  it("comes back in catalogue order whatever order it was written in", () => {
    const reply = JSON.stringify({
      blocks: [
        { kind: "comms", body: "Email." },
        { kind: "welcome", body: "Hello." },
        { kind: "rules", body: "Two rounds." },
      ],
    });
    expect(blocksFromReply(reply).map((block) => block.kind)).toEqual([
      "welcome",
      "rules",
      "comms",
    ]);
  });

  it("is asked for the catalogue rather than left to invent one", () => {
    // The prompt is built from BLOCKS, so a step added to the catalogue is
    // immediately something the model can fill in.
    const lib = readFileSync("src/lib/anthropic.ts", "utf8");
    expect(lib).toContain("The steps available, and what each is for:");
    const action = readFileSync("src/actions/portal.ts", "utf8");
    expect(action).toContain("BLOCKS.map((spec) => ({ kind: spec.kind");
    expect(BLOCKS.length).toBeGreaterThan(0);
  });

  it("refuses a description too short to have said anything", () => {
    // Below this the model has nothing to sort and fills the gap by inventing,
    // which is the one failure that puts a promise nobody made on a client's
    // page.
    const action = readFileSync("src/actions/portal.ts", "utf8");
    expect(action).toContain("said.length < 20");
  });

  it("asks for the words before it asks anything else", () => {
    // The generator is step one. Behind a later step it is a feature nobody
    // finds, because by then the boxes have been filled in by hand.
    expect(setup.indexOf('"describe"')).toBeLessThan(setup.indexOf('"words"'));
    expect(describeStep).toContain("draftBlocksAction");
  });
});
