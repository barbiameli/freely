import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Tabs are the only navigation inside a page, so four slightly different ones
 * teach people to look for them in four different ways.
 *
 * They were hand-rolled three times: Quote, Invoices and the shared component,
 * with Memory and Diary on the shared one. Within days they had drifted in
 * padding, and all of them were an underline quiet enough to be missed
 * entirely.
 *
 * One definition now, and this stops a fourth appearing.
 */
function files(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files(path, found);
    else if (path.endsWith(".tsx")) found.push(path);
  }
  return found;
}

const SHARED = "src/components/ui/tabs.tsx";
const sources = files("src").map((path) => ({ path, source: readFileSync(path, "utf8") }));

describe("the tab strip", () => {
  it("is defined in exactly one place", () => {
    const handRolled = sources
      .filter(({ path }) => path !== SHARED)
      .filter(({ source }) => source.includes('role="tablist"'))
      .map(({ path }) => path);

    expect(
      handRolled,
      "Use Tabs from components/ui/tabs rather than building another strip"
    ).toEqual([]);
  });

  it("reads as something to press before the labels are read", () => {
    // The underline version was missed because nothing said "control" until you
    // had already found it. A track around the whole strip is what says it.
    const shared = readFileSync(SHARED, "utf8");
    expect(shared).toContain("bg-paper");
    expect(shared).toContain("rounded-full");
  });

  it("marks the selected tab the way the rest of the app marks a selection", () => {
    // Same treatment as an active Chip, so it is new furniture rather than a
    // new idea to learn.
    expect(readFileSync(SHARED, "utf8")).toContain("bg-violet text-white");
  });

  it("names itself for a screen reader", () => {
    expect(readFileSync(SHARED, "utf8")).toContain("aria-label={label}");
    expect(readFileSync(SHARED, "utf8")).toContain("aria-selected={active}");
  });
});
