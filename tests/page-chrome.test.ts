import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The chrome every page shares.
 *
 * Each page used to write its own title: two sizes, two colours of subtitle,
 * three ways of putting a button beside it. None of that was a decision, it
 * accumulated, and somebody moving between Track and Invoices reads the
 * difference as two products rather than two pages.
 *
 * These check the shared pieces exist and that the pages use them. A crude
 * check, deliberately: it cannot tell whether a header reads well, but it can
 * tell when a page has quietly gone back to hand-rolling one.
 */
const APP_VIEWS = [
  "src/app/(app)/account/account-view.tsx",
  "src/app/(app)/track/track-dashboard.tsx",
  "src/app/(app)/invoices/invoices-view.tsx",
  "src/app/(app)/memory/memory-view.tsx",
  "src/app/(app)/team/team-view.tsx",
  "src/app/(app)/insights/insights-view.tsx",
  "src/app/(app)/quote/quote-wizard.tsx",
];

describe("every list page wears the same header", () => {
  for (const file of APP_VIEWS) {
    it(`uses PageHeader in ${file.split("/").pop()}`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("<PageHeader");
    });

    it(`hand-rolls no page title in ${file.split("/").pop()}`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/<h1[^>]*font-display/);
    });
  }
});

const RECORD_VIEWS = [
  "src/app/(app)/track/[projectId]/project-detail.tsx",
  "src/app/(app)/diary/[projectId]/diary-view.tsx",
  "src/app/(app)/invoices/[invoiceId]/invoice-editor.tsx",
];

describe("a record is not a page", () => {
  /**
   * A page called Track is a place; a page called "Checkout redesign" is a
   * thing inside it. They used to be set at three different sizes between
   * them, one of which was larger than the list page above it, so there was no
   * telling which level you were on.
   */
  for (const file of RECORD_VIEWS) {
    it(`uses RecordHeader in ${file.split("/").pop()}`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("<RecordHeader");
      expect(source).not.toMatch(/<h1[^>]*font-display/);
    });
  }

  it("sets a record below a page", () => {
    const header = readFileSync("src/components/ui/page-header.tsx", "utf8");
    expect(header).toMatch(/PageHeader[\s\S]*text-\[32px\]/);
    expect(header).toMatch(/RecordHeader[\s\S]*text-\[28px\]/);
  });
});

describe("controls answer when you point at them", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  /**
   * Around ninety controls are written as `cursor-pointer` and nothing else.
   * The pointer promises something will happen and the element then sits
   * there looking identical, which reads as a dead label you can click.
   */
  it("gives the two tap utilities a hover state", () => {
    expect(css).toMatch(/\.tap:hover,\s*\n\s*\.tap-row:hover/);
    expect(css).toMatch(/@media \(hover: hover\)/);
  });

  it("leaves touch screens alone, where a held hover state would stick", () => {
    const pointerOnly = css.slice(css.indexOf("@media (hover: hover)"));
    expect(pointerOnly).toContain("opacity");
  });

  // outline-none was written to stop the ring appearing on a mouse click and
  // never replaced with anything for people who never touch a mouse.
  it("shows the keyboard where it is", () => {
    expect(css).toContain("button:focus-visible");
    expect(css).toContain("outline-offset");
  });
});

describe("deleting always asks the same way", () => {
  /**
   * One delete used to ask by turning into its own confirmation and forgetting
   * the question when it lost focus. Every delete goes through the one dialog
   * now, so that a click-twice control cannot take a written update silently.
   */
  it("uses the shared dialog for a diary entry", () => {
    const source = readFileSync("src/app/(app)/diary/[projectId]/diary-view.tsx", "utf8");
    expect(source).toContain("<Confirm");
    expect(source).not.toContain("onBlur={() => setConfirming(false)}");
  });
});
