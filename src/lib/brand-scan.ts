/**
 * Reads a brand guide the cheap way, before anything is sent to a model.
 *
 * Most brand guides are not subtle documents. They say "#6320EE" and they say
 * "Heading font: Raleway", because their whole job is to be copied off by
 * somebody building a website. When a document is that explicit there is nothing
 * to interpret, and paying a model to retype four values out of it is paying for
 * a search.
 *
 * So this looks first. If it finds all four, the upload is answered in a
 * millisecond for nothing. If it finds three, the model still runs, because a
 * partly-filled form is not worth the complexity of a second, narrower call.
 * The model is the fallback for guides written as prose, or as a picture of a
 * palette with no hex codes near it.
 *
 * Deliberately conservative: a wrong colour silently rebrands somebody's quotes,
 * so every rule here needs the document to have said the thing outright.
 */

export interface BrandScan {
  primaryColor: string | null;
  accentColor: string | null;
  headingFont: string | null;
  bodyFont: string | null;
}

/** Nothing found, in the shape callers expect. */
export const EMPTY_SCAN: BrandScan = {
  primaryColor: null,
  accentColor: null,
  headingFont: null,
  bodyFont: null,
};

/** Only this much of a document is scanned, matching what the model is sent. */
const MAX_CHARS = 12000;

/**
 * Words that mean "the main one" and words that mean "the supporting one".
 *
 * Order matters within each list only in that any match is as good as another;
 * the lists exist so a guide can label its colours rather than rely on which
 * hex code happens to be printed first.
 */
const HEADING_WORDS = ["heading", "headline", "headings", "title", "titles", "display"];
const BODY_WORDS = ["body", "paragraph", "text", "copy"];

/** How a guide writes a typeface after a label: a colon, a dash, or "is". */
const SEPARATOR = "\\s*(?::|-|–|—|=|\\bis\\b)\\s*";

/**
 * A typeface name as guides write them: capitalised words, sometimes with a
 * weight or a suffix. Stopped at a line break so a run-on sentence cannot be
 * swallowed whole.
 */
const FONT_NAME = "([A-Z][A-Za-z0-9'’.]*(?:[ -][A-Z][A-Za-z0-9'’.]*){0,3})";

/** Six-digit and three-digit hex, as written anywhere in the document. */
const HEX = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

/** #abc and #AABBCC are the same colour, and the app stores one spelling. */
export function normaliseHex(raw: string): string {
  const body = raw.replace("#", "");
  const full =
    body.length === 3
      ? body
          .split("")
          .map((c) => c + c)
          .join("")
      : body;
  return `#${full.toUpperCase()}`;
}

/**
 * Black, white and greys are page furniture, not a brand colour.
 *
 * Every guide prints #FFFFFF and #000000 somewhere, usually in the type rules,
 * and taking the first two hex codes off the page would hand back white as
 * somebody's brand. Near-greys are excluded on the same reasoning: a colour with
 * almost no saturation was not chosen to be recognised.
 */
export function isBrandColour(hex: string): boolean {
  const full = normaliseHex(hex).slice(1);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Chroma as a share of brightness, which is saturation without the maths
  // library. Under a tenth is a grey wearing a colour's clothes.
  if (max === 0) return false;
  return (max - min) / max > 0.1;
}

/** Brand colours in the order the document prints them, greys removed. */
export function colours(text: string): string[] {
  const found: string[] = [];
  for (const match of Array.from(text.matchAll(HEX))) {
    const hex = normaliseHex(match[0]);
    if (!isBrandColour(hex)) continue;
    if (!found.includes(hex)) found.push(hex);
  }
  return found;
}

/** A typeface stated after one of the given labels, or null. */
export function fontFor(text: string, labels: string[]): string | null {
  for (const label of labels) {
    // "Heading font: Raleway", "Headline typeface — Inter", "Body type is Georgia".
    const pattern = new RegExp(
      `\\b${label}\\b(?:\\s+(?:font|typeface|type|family))?${SEPARATOR}${FONT_NAME}`,
      "i"
    );
    const match = text.match(pattern);
    if (!match) continue;
    const name = match[1].trim();
    // A label followed by another label is a table header, not a typeface.
    if ([...HEADING_WORDS, ...BODY_WORDS].includes(name.toLowerCase())) continue;
    return name;
  }
  return null;
}

/**
 * What can be read off the page without asking anyone.
 *
 * A guide naming one typeface for everything is common and means both, so a
 * lone body font fills the heading slot and the other way round.
 */
export function scanBrandGuide(sourceText: string): BrandScan {
  const text = sourceText.slice(0, MAX_CHARS);
  const palette = colours(text);
  const heading = fontFor(text, HEADING_WORDS);
  const body = fontFor(text, BODY_WORDS);

  return {
    primaryColor: palette[0] ?? null,
    accentColor: palette[1] ?? null,
    headingFont: heading ?? body,
    bodyFont: body ?? heading,
  };
}

/**
 * Whether the scan is complete enough to skip the model entirely.
 *
 * All four or nothing. Three out of four with a gap left for the model is a
 * second, narrower prompt to write and maintain, and the call it would replace
 * costs the same as the one it would make.
 */
export function scanIsComplete(scan: BrandScan): boolean {
  return Boolean(scan.primaryColor && scan.accentColor && scan.headingFont && scan.bodyFont);
}
