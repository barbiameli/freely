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

describe("mobile layout", () => {
  it("finds the components to check", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("gives every multi-column grid a column count for narrow screens", () => {
    // A bare grid-cols-3 puts three cards in 390px minus padding, which is
    // 110px each for a label like "Deliverables done".
    const offenders: string[] = [];
    for (const { path, source } of files) {
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
