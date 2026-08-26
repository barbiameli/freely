import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A button doing work has to say so.
 *
 * The failure this catches is quiet and everywhere. A button that runs a
 * server action and only sets `disabled` fades to half opacity and gives no
 * other sign, which reads as a control that has stopped working rather than
 * one that is busy. So the second press happens, and the second press is how
 * something gets sent twice.
 *
 * The rule is narrow on purpose: it only applies where the label itself
 * already flips on a flag, for example {saving ? "Saving..." : "Save"}. That
 * is unambiguously the button doing the work. A button disabled because a
 * different action is running is a separate case, correctly written as
 * `disabled`, and is left alone.
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

/** One <Button …>children</Button> at a time. */
// [\s\S] rather than the s flag, which needs a newer target than this
// project compiles to.
const BUTTON = /<Button\b([^>]*?)>([\s\S]*?)<\/Button>/g;

interface Offender {
  file: string;
  flag: string;
}

function offenders(): Offender[] {
  const found: Offender[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    BUTTON.lastIndex = 0;

    while ((match = BUTTON.exec(source))) {
      const [, props, body] = match;
      if (props.includes("loading=")) continue;

      const disabled = /disabled=\{([A-Za-z_$][\w$.]*)\}/.exec(props);
      if (!disabled) continue;

      const flag = disabled[1];
      // The label flipping on the same flag is what makes this the button
      // that is working, rather than one waiting on something else.
      const labelFlips = new RegExp(`\\{\\s*${flag.replace(/\$/g, "\\$")}\\s*\\?`).test(body);
      if (labelFlips) found.push({ file, flag });
    }
  }

  return found;
}

describe("buttons that are working say so", () => {
  it("finds the files to check", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("has no button that only greys itself out while it works", () => {
    const bad = offenders().map((o) => `${o.file} (${o.flag})`);
    expect(bad).toEqual([]);
  });
});

describe("the Button component supports it", () => {
  const source = readFileSync("src/components/ui/button.tsx", "utf8");

  it("takes a loading prop", () => {
    expect(source).toMatch(/loading\?: boolean/);
  });

  // Fading it out says "unavailable", and the spinner is already saying
  // "in a moment". Two signals meaning different things should not look alike.
  it("does not fade a loading button", () => {
    expect(source).toMatch(/disabled && !loading/);
  });

  it("stops a loading button being pressed again", () => {
    expect(source).toMatch(/const held = disabled \|\| loading/);
  });

  it("tells a screen reader, not just the eye", () => {
    expect(source).toMatch(/aria-busy/);
  });
});
