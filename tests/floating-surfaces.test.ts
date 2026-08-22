import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Everything that floats above the page comes from one of three components.
 *
 * The rule this enforces is proximity. A panel opened by a button has to touch
 * that button, or it reads as a section of the page that was always there
 * rather than as the consequence of a press. "Add project" on Track rendered
 * its panel after the stat cards, half a screen below the button, and nobody
 * could tell that was where the action was committed.
 *
 * Rather than police positioning, which is hard to check and easy to argue
 * with, this checks the material: `shadow-dialog` is the shadow a floating
 * surface has, and only the three components that know how to position
 * themselves are allowed to use it. A new panel therefore has to go through
 * Popover, Modal or the coach mark, all of which place themselves correctly.
 *
 * If a genuinely new kind of floating surface is needed, add it here on
 * purpose, having taught it to anchor itself first.
 */
const ALLOWED = [
  "src/components/ui/popover.tsx",
  "src/components/ui/modal.tsx",
  "src/components/guide/coach-mark.tsx",
];

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (/\.tsx?$/.test(path)) found.push(path);
  }
  return found;
}

describe("floating surfaces", () => {
  it("only exist inside the components that know how to position themselves", () => {
    const offenders = sourceFiles("src")
      .filter((path) => !ALLOWED.includes(path))
      .filter((path) => readFileSync(path, "utf8").includes("shadow-dialog"));

    expect(
      offenders,
      "A floating panel has to anchor itself to whatever opened it. Use Popover, or Modal for something that interrupts."
    ).toEqual([]);
  });

  it("has exactly one popover implementation", () => {
    // Two would drift apart within a week, which is how Track ended up with a
    // panel that looked nothing like the notification panel.
    const implementations = sourceFiles("src").filter((path) =>
      readFileSync(path, "utf8").includes("export function Popover(")
    );
    expect(implementations).toEqual(["src/components/ui/popover.tsx"]);
  });
});
