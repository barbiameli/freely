import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The bug this exists to stop coming back.
 *
 * `funnel` used to declare a local arrow that closed over its `events`
 * parameter and called it five times. That is ordinary JavaScript and every
 * unit test passed. Then the production build inlined `funnel` into the
 * Insights page, renamed `events` to the caller's variable for the first call
 * only, and left the other four pointing at a name that no longer existed. The
 * page threw "events is not defined" in production and nowhere else.
 *
 * A test that runs the function cannot catch this, because the function is
 * correct. The defect is created by the minifier, so what is checked here is
 * the shape of the source: no helper inside these functions may close over the
 * rows. Pass them in as an argument instead.
 */
const SOURCE = readFileSync(join(process.cwd(), "src/lib/metrics.ts"), "utf8");

describe("lib/metrics stays safe to inline", () => {
  it("declares no local function that could close over a parameter", () => {
    const lines = SOURCE.split("\n");
    const offenders: string[] = [];

    let depth = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      // Inside a function body, a `const x = (...) =>` or `function x(` is the
      // shape that gets inlined wrongly. At the top level it is fine.
      if (depth > 0 && /^(const|let|var)\s+\w+\s*(:[^=]+)?=\s*(\(|async\s*\(|function\b)/.test(trimmed)) {
        // Only a problem when it is a function, rather than a value that
        // happens to start with a bracket.
        if (/=>|function\b/.test(trimmed)) offenders.push(trimmed);
      }
      if (depth > 0 && /^function\s+\w+/.test(trimmed)) offenders.push(trimmed);

      depth += (line.match(/\{/g) ?? []).length;
      depth -= (line.match(/\}/g) ?? []).length;
      if (depth < 0) depth = 0;
    }

    expect(offenders).toEqual([]);
  });

  // The inner arrows passed to filter and map are fine: they are arguments to
  // a call, not hoisted declarations, and the minifier keeps their scope. This
  // is here so the rule above is not read as banning them.
  it("still allows callbacks passed straight to array methods", () => {
    expect(SOURCE).toMatch(/\.filter\(/);
  });
});
