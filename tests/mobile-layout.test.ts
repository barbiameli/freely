import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The mobile rules that keep getting broken by accident.
 *
 * Every one of these has actually shipped and been reported. They are all
 * invisible on a laptop, which is why they keep coming back: the layout is
 * written at the width it is being looked at, and the phone case is remembered
 * only when someone opens the phone.
 */
function tsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) tsxFiles(path, found);
    else if (path.endsWith(".tsx")) found.push(path);
  }
  return found;
}

const files = tsxFiles("src").map((path) => ({ path, source: readFileSync(path, "utf8") }));

/**
 * Grids that are meant to keep their column count on a phone.
 *
 * The rule below exists because three cards in 390px is 110px each for a
 * label. A week strip is not that: seven columns of a bar and a three-letter
 * day is exactly what it should be at any width, and stacking it into a column
 * of seven rows would stop it being a week.
 *
 * Listed by file rather than silenced with a comment in the markup, so adding
 * one is a decision somebody makes here, in the test, where it can be argued
 * with.
 */
const KEEPS_ITS_COLUMNS = ["src/components/track/time-week.tsx"];

describe("mobile layout", () => {
  it("finds the components to check", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("gives every multi-column grid a column count for narrow screens", () => {
    // A bare grid-cols-3 puts three cards in 390px minus padding, which is
    // 110px each for a label like "Deliverables done".
    const offenders: string[] = [];
    for (const { path, source } of files) {
      if (KEEPS_ITS_COLUMNS.includes(path)) continue;
      for (const line of source.split("\n")) {
        // A responsive prefix on the multi-column class is the fix, and so is
        // declaring grid-cols-1 or grid-cols-2 as the base.
        const bare = /(?<![a-z:-])grid-cols-[3-9]\b/.exec(line);
        if (!bare) continue;
        if (/grid-cols-1\b|grid-cols-2\b/.test(line)) continue;
        offenders.push(`${path}: ${line.trim().slice(0, 100)}`);
      }
    }
    expect(
      offenders,
      "Add a base grid-cols-1 or grid-cols-2, or put the multi-column count behind sm:/md:/lg:"
    ).toEqual([]);
  });

  it("never expands the tap area of something that already fills its row", () => {
    // .tap reaches 15px in every direction. On a full-width row that pushes
    // the hit area past the row and steals taps from the row above or below,
    // so a tap near a boundary acts on the wrong item. Small controls only.
    const offenders: string[] = [];
    for (const { path, source } of files) {
      for (const line of source.split("\n")) {
        if (!/\btap\b/.test(line)) continue;
        if (/\btap-row\b/.test(line)) continue;
        if (/flex-1|w-full/.test(line)) {
          offenders.push(`${path}: ${line.trim().slice(0, 100)}`);
        }
      }
    }
    expect(
      offenders,
      "This control already fills its row. Drop .tap, or use .tap-row if it sits in a list."
    ).toEqual([]);
  });

  it("keeps fixed pixel widths behind a breakpoint or a max-width", () => {
    // w-[420px] on a 390px screen is a horizontal scrollbar. Behind md:, or
    // expressed as max-w, it is fine.
    const offenders: string[] = [];
    for (const { path, source } of files) {
      for (const line of source.split("\n")) {
        const match = /(?<![a-z:-])w-\[(\d{3,4})px\]/.exec(line);
        if (!match) continue;
        if (Number(match[1]) <= 360) continue;
        // Guarded either by a breakpoint prefix on the width itself, or by the
        // element being full width until then.
        if (/(sm|md|lg|xl):w-\[/.test(line)) continue;
        if (/max-w-\[/.test(line)) continue;
        if (/w-full/.test(line)) continue;
        // Out of flow, and in practice clipped by an overflow-hidden parent:
        // a decorative blob cannot widen the page the way a flow element can.
        if (/\babsolute\b|\bfixed\b/.test(line)) continue;
        offenders.push(`${path}: ${line.trim().slice(0, 100)}`);
      }
    }
    expect(
      offenders,
      "Use max-w-[...], or w-full with the fixed width behind md:"
    ).toEqual([]);
  });
});

/**
 * The two panels, on a phone.
 *
 * Both were desktop shapes that had never been given a phone answer: a centred
 * 420px card on a 390px screen, and a dropdown anchored to a button that is as
 * wide as the screen anyway. Both become sheets, which is what the phone's own
 * apps do, and which puts the way out under the thumb rather than at the top
 * of the screen.
 */
describe("panels on a phone", () => {
  const modal = readFileSync("src/components/ui/modal.tsx", "utf8");
  const popover = readFileSync("src/components/ui/popover.tsx", "utf8");

  it("pins the dialog to the bottom on a phone and centres it above", () => {
    expect(modal).toContain("items-end sm:items-center");
    expect(modal).toContain("rounded-t-card sm:rounded-card");
  });

  it("caps the sheet's height so the content scrolls inside it", () => {
    expect(modal).toMatch(/max-h-\[\d+vh\]/);
  });

  it("turns a popover into a sheet on a phone", () => {
    expect(popover).toContain("useIsPhone");
    expect(popover).toContain("<Modal");
  });

  it("lets the sheet keep the popover's own heading rather than adding a second", () => {
    expect(popover).toContain("bare");
    expect(modal).toContain("bare ?");
  });
});

describe("the home indicator", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  // A bar pinned to the bottom of an iPhone sits under the system's own strip,
  // which swallows the last few millimetres of every tap.
  it("keeps a safe area at the bottom", () => {
    expect(css).toContain("env(safe-area-inset-bottom");
  });

  it("gives it to the nav and to the sheet", () => {
    expect(readFileSync("src/components/sidebar.tsx", "utf8")).toContain("safe-bottom");
    expect(readFileSync("src/components/ui/modal.tsx", "utf8")).toContain("safe-bottom");
  });
});
