import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A spinner that stops is not feedback.
 *
 * A refine used to end with the button returning to "Regenerate" and the box
 * emptying, which says something finished without saying what. On a quote long
 * enough to scroll, the rewritten paragraph is usually off-screen, so the
 * honest read of that ending was that nothing had happened.
 */
const view = readFileSync("src/app/(app)/quote/[briefId]/brief-view.tsx", "utf8");
const actions = readFileSync("src/actions/briefs.ts", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

describe("a refine says what it did", () => {
  it("works out what changed where both versions exist", () => {
    expect(actions).toContain("function changedSections");
    // After the refresh the page holds the new version only, so it cannot
    // work this out for itself.
    expect(actions).toContain("changed: changedSections(current, updated)");
  });

  it("names every section it could have touched", () => {
    for (const key of [
      "overview",
      "strategy",
      "scope",
      "deliverables",
      "timeline",
      "paymentTerms",
      "revisions",
      "availability",
      "aiUsage",
      "terms",
    ]) {
      expect(actions, key).toContain(`"${key}"`);
    }
  });

  it("says so in words next to the button that did it", () => {
    expect(view).toContain("refineChanged");
    expect(view).toContain("refineShowMe");
  });

  it("says when a refine changed nothing, rather than looking the same as success", () => {
    expect(view).toContain("refineNothing");
    expect(view).toContain("refined.length === 0");
  });
});

describe("and shows you where", () => {
  it("marks every section with a name to scroll to", () => {
    expect(view).toContain("data-section=");
    expect(view).toContain('data-section="overview"');
  });

  it("scrolls to the first thing that changed", () => {
    expect(view).toContain("scrollIntoView");
    expect(view).toContain("block: \"center\"");
  });

  it("fades the highlight rather than leaving it on the page", () => {
    expect(css).toContain("@keyframes just-changed");
    expect(css).toMatch(/\.just-changed \{\s*\n\s*animation: just-changed/);
  });

  it("still says which one when motion is turned down", () => {
    const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(reduced).toContain("box-shadow");
  });
});
