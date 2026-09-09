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
  // The pink is not in this list. It is 3.5:1 on white, which is the whole
  // reason small interactive text moved to `link` and a filled button carries
  // ink: the brand runs on one accent, so the two uses it cannot serve went
  // elsewhere rather than the colour being diluted into two.
  ["link", WHITE],
  ["link", "paper"],
  ["success", WHITE],
  ["success", "mint-solid"],
  ["overdue", WHITE],
  ["overdue", "paper"],
];

/**
 * The pink is a display colour: headings, marks and strokes, never body text.
 *
 * `coral` and `violet` are the same value now. Both are checked, because both
 * names are in use across the app and a future edit could move one of them.
 */
const LARGE_TEXT: [string, string][] = [
  ["coral", WHITE],
  ["coral", "paper"],
  ["violet", WHITE],
  ["violet", "paper"],
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

describe("a filled control's label", () => {
  // A filled button's label is normal text however bold it is, so 3:1 is not
  // enough.
  for (const fill of ["overdue", "ink"]) {
    it(`white on ${fill}`, () => {
      expect(Number(contrast(WHITE, colour(fill)).toFixed(2)), fill).toBeGreaterThanOrEqual(4.5);
    });
  }

  // The primary. White on this pink is 3.5 and fails; ink on it is 5.1 and
  // is also the bolder of the two, so the button carries ink.
  it("ink on the pink, not white", () => {
    expect(Number(contrast(colour("ink"), colour("violet")).toFixed(2))).toBeGreaterThanOrEqual(4.5);
    expect(Number(contrast(WHITE, colour("violet")).toFixed(2))).toBeLessThan(4.5);
  });

  // Lime never carries a word on white, and on ink it is the clearest thing
  // in the palette. That asymmetry is the whole rule for it.
  it("ink on lime, and lime on nothing pale", () => {
    expect(Number(contrast(colour("ink"), colour("lime")).toFixed(2))).toBeGreaterThanOrEqual(4.5);
    expect(Number(contrast(colour("lime"), WHITE).toFixed(2))).toBeLessThan(3);
  });
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

  /*
   * The floor moved when the ink did.
   *
   * On the old #343434, white at 50 percent composited to 4.42 and failed,
   * which is why the block below checks that nothing uses it. The rebrand's
   * ink is #1A1626, a good deal darker, so 50 percent now clears 4.5 and 40
   * is the first step that does not. The rule the app follows is unchanged:
   * nothing goes below the level that passes.
   */
  it("white at 40 percent is not, and is the floor nothing goes under", () => {
    expect(Number(overInk(0.5).toFixed(2))).toBeGreaterThanOrEqual(4.5);
    expect(Number(overInk(0.4).toFixed(2))).toBeLessThan(4.5);
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

/**
 * The pink never carries small text.
 *
 * It is 3.5:1 on white, which is fine behind large type and fine as a fill,
 * and not enough for a 13px link. An SVG stroke is not text and has no size
 * threshold to clear, so an icon keeps the accent; anything that spells a
 * word takes `link`.
 *
 * This is the rule that kept getting broken by hand, twice in one afternoon,
 * because `text-violet` reads like a colour rather than like a decision.
 */
describe("pink is not a text colour", () => {
  it("appears only on things that take a size prop", () => {
    const offenders: string[] = [];
    for (const file of allSource("src")) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!line.includes("text-violet") || line.includes("text-violet-tint")) return;
        // An icon names its size within a line or two of its class list.
        const near = lines.slice(Math.max(0, i - 3), i + 3).join("\n");
        if (!near.includes("size={")) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * The two button weights are different shapes, not two strengths of pink.
 *
 * The secondary was the primary's own colour drawn as an outline, so a row
 * with both on it read as one button and its echo.
 */
describe("the button pair", () => {
  const button = readFileSync("src/components/ui/button.tsx", "utf8");

  it("does not draw the secondary in the primary's colour", () => {
    expect(button).not.toContain("border border-violet");
    expect(button).toContain("border-[1.5px] border-ink");
  });

  it("fills on hover rather than tinting", () => {
    expect(button).toContain("hover:bg-ink hover:text-white");
  });
});
