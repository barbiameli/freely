import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Things that do the same job look the same.
 *
 * A section heading with a line of explanation under it appeared in fifteen
 * places, and the gap beneath it had drifted to eight different values: mb-1,
 * mb-2, mb-2.5, mb-3, mb-4, mb-0, and two variants with text-pretty. Nobody
 * chose any of that. It is what happens when a pattern is copied from whichever
 * file was already open.
 *
 * The result is two cards doing the same job sitting differently on the page,
 * which reads as carelessness even to somebody who could not say why.
 *
 * These checks are about vocabulary rather than taste. They cannot say whether
 * a screen is well designed; they can say whether it was assembled from the
 * same parts as every other screen.
 */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const files = [...sourceFiles("src/app"), ...sourceFiles("src/components")];

function offenders(pattern: RegExp, exempt: string[] = []): string[] {
  return files
    .filter((f) => !exempt.includes(f))
    .filter((f) => pattern.test(readFileSync(f, "utf8")));
}

describe("a heading and its hint are one component", () => {
  it("finds the files to check", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  // The exact shape that had drifted eight ways. CardHeader now owns it.
  it("nobody hand-builds a heading hint with its own margin", () => {
    const bad = offenders(
      /<\/Label>\s*\n\s*<p className="text-caption text-text-muted mt-1 mb-(?:1|2|2\.5|3|4)/
    );
    expect(bad).toEqual([]);
  });
});

describe("the card vocabulary", () => {
  const card = readFileSync("src/components/ui/card.tsx", "utf8");

  it("offers exactly three tones", () => {
    expect(card).toMatch(/type Tone = "plain" \| "quiet" \| "loud"/);
  });

  // A fourth tone would be a decision to make each time rather than a rule to
  // follow, which is how the eight margins happened.
  it("names no fourth tone", () => {
    const tones = card.match(/^\s{2}(plain|quiet|loud|[a-z]+):\s/gm) ?? [];
    expect(tones.length).toBeLessThanOrEqual(3);
  });

  it("gives a quiet card no border of its own", () => {
    expect(card).toMatch(/quiet: "bg-paper border border-transparent"/);
  });
});

describe("the type scale", () => {
  const config = readFileSync("tailwind.config.ts", "utf8");

  // Six steps, each with a job. Arbitrary sizes in class names are how a scale
  // stops being one.
  it("keeps its named steps", () => {
    for (const step of ["caption", "meta", "small", "body", "lead", "title"]) {
      expect(config, step).toMatch(new RegExp(`${step}: \\[`));
    }
  });
});
