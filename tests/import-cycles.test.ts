import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * No module may import itself back, however long the way round.
 *
 * A cycle between two modules is legal TypeScript, passes every test, builds
 * without a warning, and then throws "Cannot access 'X' before initialization"
 * in a browser against a production bundle, because the bundler suspended one
 * module halfway through to evaluate the other and something read a const that
 * had not been assigned yet.
 *
 * It cost an afternoon. lib/currencies re-exported formatMoney from lib/money
 * purely so an old import path kept working, lib/money imported currencySymbol
 * back, and the pair sat there harmlessly until an unrelated change moved the
 * module graph around them and the quote page stopped rendering. The stack
 * trace named a minified variable and nothing else.
 *
 * Type-only imports are erased before any of this matters, so they are not
 * cycles and are not counted.
 */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

/** Where "@/lib/money" actually lives on disk, or null for a package. */
function resolve(spec: string, known: Set<string>): string | null {
  if (!spec.startsWith("@/")) return null;
  const base = join("src", spec.slice(2));
  for (const ending of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    if (known.has(base + ending)) return base + ending;
  }
  return null;
}

/**
 * The imports that survive compilation.
 *
 * `import type { X }` and `import { type X }` are both erased, so neither can
 * put two modules in a cycle at runtime. A bare `import "./x"` and a
 * `export { x } from "./y"` both do.
 */
function runtimeImports(source: string, known: Set<string>): string[] {
  const out: string[] = [];
  const pattern = /(?:import|export)\s+(type\s+)?([^;]*?)\s+from\s+"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    if (match[1]) continue;
    const clause = match[2];
    const braces = /\{([^}]*)\}/.exec(clause);
    const outside = clause.replace(/\{[^}]*\}/, "").replace(/,/g, "").trim();
    if (braces && !outside) {
      const names = braces[1].split(",").map((n) => n.trim()).filter(Boolean);
      if (names.length > 0 && names.every((n) => n.startsWith("type "))) continue;
    }
    const target = resolve(match[3], known);
    if (target) out.push(target);
  }
  return out;
}

describe("the module graph has no cycles", () => {
  it("finds none anywhere under src", () => {
    const files = sourceFiles("src");
    const known = new Set(files);
    const graph = new Map<string, string[]>();
    for (const file of files) {
      graph.set(file, runtimeImports(readFileSync(file, "utf8"), known));
    }

    // Depth-first, remembering the route in, so the failure names the loop
    // rather than just saying one exists.
    const done = new Set<string>();
    const onRoute = new Set<string>();
    const cycles: string[] = [];

    function walk(file: string, route: string[]): void {
      if (onRoute.has(file)) {
        const from = route.indexOf(file);
        cycles.push([...route.slice(from), file].join(" -> "));
        return;
      }
      if (done.has(file)) return;
      onRoute.add(file);
      for (const next of graph.get(file) ?? []) walk(next, [...route, file]);
      onRoute.delete(file);
      done.add(file);
    }

    for (const file of files) walk(file, []);

    expect(cycles).toEqual([]);
  });
});
