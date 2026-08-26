import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every colour pairing the app actually uses, measured.
 *
 * Contrast is the one design property that can be wrong by a precise amount
 * and still look fine to the person who chose it. `text-muted` was 3.46:1 on
 * white and carried most of the secondary text in the app at eleven pixels,
 * which is below what WCAG AA asks for normal text and had been there since
 * the beginning without anybody noticing, because it reads perfectly well on
 * a good screen in a lit room.
 *
 * So it is computed rather than eyeballed. The ratios come from the palette in
 * tailwind.config.ts, so changing a colour there is what makes this fail, and
 * the failure names the pairing and the number.
 *
 * WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text (18.66px bold or
 * 24px) and for meaningful non-text things like icons and borders.
 */
const CONFIG = readFileSync("tailwind.config.ts", "utf8");

function allSource(dir = "src"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...allSource(path));
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/** Reads a hex colour out of the Tailwind palette by its name. */
function colour(name: string): string {
  const quoted = new RegExp(`"${name}":\\s*"(#[0-9A-Fa-f]{6})"`).exec(CONFIG);
  const bare = new RegExp(`\\b${name}:\\s*"(#[0-9A-Fa-f]{6})"`).exec(CONFIG);
  const found = quoted?.[1] ?? bare?.[1];
  if (!found) throw new Error(`No hex colour named ${name} in tailwind.config.ts`);
  return found;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(n.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const WHITE = "#FFFFFF";

/** Text that has to be readable at ordinary sizes. */
const NORMAL_TEXT: [string, string][] = [
  ["ink", WHITE],
  ["ink", "paper"],
  ["slate", WHITE],
  ["slate", "paper"],
  ["slate", "mint"],
  // The one that was failing. It carries most of the secondary text in the
  // app, at the smallest size in the type scale.
  ["text-muted", WHITE],
  ["text-muted", "paper"],
  ["violet", WHITE],
  ["violet", "paper"],
  ["success", WHITE],
  ["success", "mint-solid"],
  ["overdue", WHITE],
  ["overdue", "paper"],
];

/** Coral is a display colour. Headings and marks, never body text. */
const LARGE_TEXT: [string, string][] = [
  ["coral", WHITE],
  ["coral", "paper"],
];

describe("normal text meets AA", () => {
  for (const [fg, bg] of NORMAL_TEXT) {
    it(`${fg} on ${bg === WHITE ? "white" : bg}`, () => {
      const ratio = contrast(colour(fg), bg === WHITE ? WHITE : colour(bg));
      expect(Number(ratio.toFixed(2)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("display colours meet the large-text threshold", () => {
  for (const [fg, bg] of LARGE_TEXT) {
    it(`${fg} on ${bg === WHITE ? "white" : bg}`, () => {
      const ratio = contrast(colour(fg), bg === WHITE ? WHITE : colour(bg));
      expect(Number(ratio.toFixed(2)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("white on a filled control", () => {
  // A filled button's label is normal text however bold it is, so 3:1 is not
  // enough. Coral is not in this list on purpose: white on coral is 3.21 and
  // coral is never a button fill.
  for (const fill of ["violet", "overdue", "ink"]) {
    it(`white on ${fill}`, () => {
      expect(Number(contrast(WHITE, colour(fill)).toFixed(2)), fill).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("the dark hero block", () => {
  // The quote page puts an 11px label on the ink block. Plain coral is 3.88
  // there, which is why coral-light exists.
  it("coral-light is readable on ink", () => {
    expect(
      Number(contrast(colour("coral-light"), colour("ink")).toFixed(2))
    ).toBeGreaterThanOrEqual(4.5);
  });

  // Dark surfaces use white at an opacity rather than a grey from the
  // palette, so the real question is which opacities are safe. /50 composites
  // to 4.42 against ink and was in use on the quote page's price block, which
  // is the one number on that screen somebody has to read.
  const overInk = (alpha: number) => {
    const ink = colour("ink").replace("#", "");
    const mixed = [0, 2, 4]
      .map((i) => Math.round(alpha * 255 + (1 - alpha) * parseInt(ink.slice(i, i + 2), 16)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    return contrast(`#${mixed}`, colour("ink"));
  };

  it("white at 60 percent is readable on ink", () => {
    expect(Number(overInk(0.6).toFixed(2))).toBeGreaterThanOrEqual(4.5);
  });

  it("white at 50 percent is not, which is why nothing uses it", () => {
    expect(Number(overInk(0.5).toFixed(2))).toBeLessThan(4.5);
  });
});

describe("nothing uses an opacity that fails", () => {
  // The ratio test above proves /50 is too faint. This proves nothing is
  // using it, which is the part that actually affects somebody reading a
  // price on a dark block.
  it("no text-white/50 anywhere", () => {
    const offenders = allSource().filter((f) => /text-white\/50\b/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("the borders that carry meaning", () => {
  // A hairline separating rows is decoration. A focus ring is not, and the
  // rule for non-text is 3:1.
  it("violet reads as a focus ring on white", () => {
    expect(Number(contrast(colour("violet"), WHITE).toFixed(2))).toBeGreaterThanOrEqual(3);
  });
});
