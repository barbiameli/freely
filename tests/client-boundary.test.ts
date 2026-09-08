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

describe("the pages outside the app shell read every string from the dictionary", () => {
  /**
   * Marketing, sign in, sign up and onboarding are the screens someone meets
   * before they have chosen a language, and they were the last to be
   * translated. Each was half done: the headings came from the dictionary and
   * the buttons and helper text underneath were English literals, so a Spanish
   * visitor got a Spanish title above an English form. Nothing failed, because
   * a hardcoded string is valid TypeScript.
   *
   * Checking only marketing.tsx is what let the onboarding ones through, so
   * this covers all four areas. It reads the text out of the JSX and fails on
   * any of it that is a literal.
   *
   * It covers the whole of src/ now. It used to check only marketing, auth and
   * onboarding, on the grounds that the rest was a backlog rather than a
   * regression. The backlog was 154 strings, including every heading on the
   * quote PDF and the public quote page, so a Spanish quote reached the client
   * with English headings and nothing anywhere said so. It has been swept, and
   * this is what stops it coming back.
   */
  const areas = ["src"];

  /**
   * What is allowed to stay in English, and why.
   *
   * "Freely" is a brand name. The terms page is a legal document, and a
   * mistranslated liability clause is worse than an English one, so it is
   * deliberately left until it can be translated by someone qualified to.
   */
  const exemptFiles = [
    "src/app/terms/page.tsx",
    // A contract, in one governing language on purpose. See lib/dpa: a
    // mistranslated liability or audit clause is a liability of its own,
    // which is the reverse of the reasoning for the terms page.
    "src/app/dpa/page.tsx",
    // The product's own dashboard, behind ADMIN_EMAIL. One reader, who is the
    // person writing the app, so translating it would be work with no audience.
    // Worth revisiting the moment anybody else is given the address.
    "src/app/(app)/insights/insights-view.tsx",
    "src/app/(app)/insights/mailing-list.tsx",
    "src/app/(app)/insights/roadmap-card.tsx",
    "src/app/(app)/insights/testing-card.tsx",
    // Admin-only, same as the testing card beside it: a workbench nobody
  // else can open does not need translating.
  "src/app/(app)/insights/reading-card.tsx",
];
  const exemptText = ["Freely"];

  const files = areas
    .flatMap((area) =>
      area.endsWith(".tsx") ? [area] : sourceFiles(area).filter((f) => f.endsWith(".tsx")),
    )
    .filter((f) => !exemptFiles.includes(f));

  it("finds the files to check", () => {
    expect(files.length).toBeGreaterThanOrEqual(40);
  });

  for (const path of files) {
    it(`${path} has no hardcoded text between JSX tags`, () => {
      const source = stripComments(readFileSync(path, "utf8"));

      // Text sitting directly between tags: >Log in<. Braces are excluded, so
      // >{t.marketing.logIn}< does not match, and neither does nesting.
      // exec in a loop rather than matchAll, whose iterator needs a newer
      // compile target than this project uses.
      const pattern = />([^<>{}]*[A-Za-z]{3,}[^<>{}]*)</g;
      const literals: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        const text = match[1].trim();
        // A generic spanning a line break looks like text between tags:
        // `Dispatch<SetStateAction<string | null>>` leaves `;` and fragments
        // behind. Filtering on code punctuation rather than on length, so a
        // one-word label like "Files" is still caught.
        const looksLikeCode =
          /[;{}|]/.test(text) || text.startsWith(")") || text.endsWith("(");
        if (text && !looksLikeCode && !exemptText.includes(text)) literals.push(text);
      }

      expect(
        literals,
        `Hardcoded text. Move it into en.ts and es.ts:\n${literals.join("\n")}`,
      ).toEqual([]);
    });
  }
});
