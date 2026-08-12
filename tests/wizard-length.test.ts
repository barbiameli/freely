import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The wizard's length, as a test.
 *
 * It had fourteen fields on its first screen and a second screen after that.
 * About four of those were about the job; the rest were about the freelancer,
 * asked again on every quote. They live on the account now.
 *
 * Nothing stops that growing back. Every one of those fields was added for a
 * reason, one at a time, by somebody reasonable, which is exactly how a form
 * gets to fourteen fields without anyone deciding it should. So the shape is
 * asserted rather than remembered: adding a question to the quote screen now
 * means changing this test on purpose, which is the moment to ask whether the
 * answer changes between one job and the next.
 */
const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");
const setupRows = readFileSync("src/components/quote/setup-rows.tsx", "utf8");

describe("the quote wizard", () => {
  it("is one screen", () => {
    // A second step is what the setup rows replaced. If a `step` state comes
    // back, the screen has been split again.
    expect(wizard).not.toMatch(/useState\(0\);?\s*\/\/.*step/i);
    expect(wizard).not.toMatch(/\bsetStep\b/);
    expect(wizard).not.toMatch(/step === 1/);
  });

  it("asks nothing that belongs on the account", () => {
    // Each of these was a per-quote question and is now remembered. Finding one
    // back in the wizard means it is being asked on every quote again.
    const movedToMemory = [
      "QUOTE_INCLUSIONS",
      "BRANDING_OPTIONS",
      "rememberThisRate",
      "t.quote.addSections",
    ];
    const found = movedToMemory.filter((name) => wizard.includes(name));
    expect(found, "These moved to the account. Edit them in Memory, not here.").toEqual([]);
  });

  it("keeps the setup to four rows", () => {
    // Four decisions: what you charge, when you get paid, what the quote
    // includes, what the client receives. A fifth row means one of those has
    // been split, which is worth doing deliberately rather than by accident.
    const rows = setupRows.match(/case "(rate|payment|sections|presentation)":/g) ?? [];
    expect(new Set(rows).size).toBe(4);
  });

  it("states every remembered value in words on the closed row", () => {
    // The whole safety net. A row that only says "Sections" cannot stop last
    // month's terms going out again; describeRow is what makes it readable
    // without opening anything.
    expect(setupRows).toContain("describeRow(row, setup, words, symbol)");
  });

  it("shows what the usual was whenever a row has been changed", () => {
    // And offers both ways out, so a one-off neither rewrites the setup nor
    // leaves any way to keep it.
    expect(setupRows).toContain("t.quote.setupUsually");
    expect(setupRows).toContain("t.quote.setupPutBack");
    expect(setupRows).toContain("t.quote.setupMakeUsual");
  });

  it("asks seniority only where it can change a number", () => {
    // Given a rate, the level says nothing the figure does not. It belongs
    // inside the rate helper, which only opens when there is no rate.
    const helperStart = setupRows.indexOf("rateHelpOpen && (");
    const expertiseAt = setupRows.indexOf("t.quote.expertise}");
    expect(helperStart).toBeGreaterThan(-1);
    expect(expertiseAt).toBeGreaterThan(helperStart);
  });
});
