import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * The page has more than one plane.
 *
 * Paper behind, white cards on top, one surface. Six cards down a page read
 * as a single sheet with lines drawn on it, and nothing on screen was nearer
 * or further away than anything else.
 */
const css = readFileSync("src/app/globals.css", "utf8");
const backdrop = readFileSync("src/components/backdrop.tsx", "utf8");
const shell = readFileSync("src/app/(app)/layout.tsx", "utf8");
const card = readFileSync("src/components/ui/card.tsx", "utf8");
const transition = readFileSync("src/components/page-transition.tsx", "utf8");

describe("the backdrop", () => {
  it("sits behind everything and eats no clicks", () => {
    // A decoration that swallows a press is a bug.
    expect(backdrop).toContain("-z-10");
    expect(backdrop).toContain("pointer-events-none");
    expect(shell).toContain("<Backdrop />");
  });

  it("is soft enough not to compete with a figure", () => {
    expect(backdrop).toContain("blur-[120px]");
    expect(backdrop).toContain("opacity-[0.14]");
  });

  it("moves the two washes on different rhythms", () => {
    // In step they stop being two washes and become one moving object.
    expect(backdrop).toContain("animate-drift-a");
    expect(backdrop).toContain("animate-drift-b");
  });
});

describe("cards", () => {
  it("lift off the surface", () => {
    expect(css).toContain(".lift {");
    expect(card).toContain('tone === "plain" && "lift"');
  });

  it("do not lift when they are subordinate", () => {
    // Something that belongs inside another card should not float away
    // from it.
    expect(card).toContain('tone === "plain"');
  });

  it("can arrive in order", () => {
    expect(css).toContain(".rise-1 { animation-delay: 0.04s; }");
    expect(css).toContain(".rise-6");
    expect(card).toContain("rise-${rise}");
  });
});

describe("motion", () => {
  it("plays the page transition on every navigation, not just the first", () => {
    // Without the key it runs once on load and never again, which is the
    // trap this pattern usually falls into.
    expect(transition).toContain("key={pathname}");
  });

  it("keeps the transition under the threshold of a delay", () => {
    // It happens on every single navigation.
    expect(css).toContain("animation: page-in 0.18s ease-out both;");
  });

  it("turns everything off for somebody who asked for less", () => {
    const guard = css.slice(css.lastIndexOf("prefers-reduced-motion: reduce"));
    for (const name of [".rise", ".page-in", ".press", ".dragging"]) {
      expect(guard).toContain(name);
    }
  });
});
