import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the server/client boundary around the translation hooks.
 *
 * useT and useLocale read a React context out of a "use client" module. A
 * server component that calls one compiles cleanly, passes lint, passes every
 * unit test, and then throws on the first request in production. That is
 * exactly what happened to the marketing page at "/": it rendered on the
 * server, called useT(), and every visitor got the error boundary instead of
 * the site.
 *
 * Nothing in the toolchain catches this, so it is caught here. A server
 * component needs its strings from serverDict() and passed down as a prop.
 */
function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (/\.tsx?$/.test(path)) found.push(path);
  }
  return found;
}

/**
 * Comments out, so that prose describing the rule is not read as a breach of
 * it. Block comments go first, then whole-line // comments; a trailing comment
 * after real code is left alone, since the code on that line still counts.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/** The first thing in the file that is not a comment or blank. */
function declaresUseClient(source: string): boolean {
  const firstMeaningful = source
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "" && !line.startsWith("//") && !line.startsWith("*") && !line.startsWith("/*"));
  return firstMeaningful === '"use client";' || firstMeaningful === "'use client';";
}

describe("client-only hooks stay inside client components", () => {
  const files = sourceFiles("src");

  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no server component calls useT() or useLocale()", () => {
    const offenders = files.filter((path) => {
      const source = readFileSync(path, "utf8");
      // The definitions themselves live in the context module, which is a
      // client module: match calls, not `export function useT()`.
      const code = stripComments(source).replace(/export function use(?:T|Locale)\(\)/g, "");
      const calls = /\buse(?:T|Locale)\(\)/.test(code);
      return calls && !declaresUseClient(source);
    });

    expect(
      offenders,
      `These render on the server but call a client hook. Use serverDict() and pass the dictionary as a prop:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("the marketing page reads every string from the dictionary", () => {
  /**
   * The page at "/" is the one screen a Spanish speaker sees before they have
   * an account, and it spent a while half translated: two strings came from
   * the dictionary and the rest were English literals in the JSX. Nothing
   * failed, because a hardcoded string is valid TypeScript.
   *
   * This reads the rendered text out of the JSX and fails on any of it that is
   * a literal. Text belongs in en.ts and es.ts.
   */
  it("has no hardcoded text between JSX tags", () => {
    const source = stripComments(readFileSync("src/app/marketing.tsx", "utf8"));

    // Text sitting directly between tags: >Log in<. Braces are excluded, so
    // >{t.marketing.logIn}< does not match, and neither does nesting.
    // exec in a loop rather than matchAll, whose iterator needs a newer
    // compile target than this project uses.
    const pattern = />([^<>{}]*[A-Za-z]{3,}[^<>{}]*)</g;
    const literals: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const text = match[1].trim();
      if (text) literals.push(text);
    }

    expect(
      literals,
      `Hardcoded text on the marketing page. Move it into en.ts and es.ts:\n${literals.join("\n")}`,
    ).toEqual([]);
  });
});
