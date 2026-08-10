/**
 * Making generated quote text readable.
 *
 * The model writes deliverables the way a good proposal does: a name, then a
 * comma, then everything it includes. As a single run of text at one weight
 * that is a wall, and a quote is a document a client skims before they read
 * it. Splitting the name from its description and giving each some air costs
 * nothing and changes how the page reads.
 *
 * Deliberately presentational: nothing here rewrites the copy, it only
 * decides where the line breaks go, so what the client sees is still exactly
 * what was generated and edited.
 */

/** Long enough that a lead clause is a name rather than a stray fragment. */
const MIN_LEAD = 8;
/** Beyond this a lead is a sentence, not a name. */
const MAX_LEAD = 70;

export interface SplitText {
  /** The name, shown on its own line. */
  lead: string;
  /** Everything after it, or empty when there is nothing to split. */
  detail: string;
}

/**
 * Splits "Token foundations, colour and spacing set up as Variables" into its
 * name and its description.
 *
 * Only splits at the first comma, colon or spaced dash, and only when what
 * comes before is short enough to be a name and what comes after is long
 * enough to be worth separating. Anything else is left whole, since a bad
 * split reads worse than no split.
 */
export function splitDeliverable(text: string): SplitText {
  const trimmed = text.trim();
  const match = trimmed.match(/^([^\n]+?)(?:,|:|\s[-–]\s)\s*([\s\S]+)$/);
  if (!match) return { lead: trimmed, detail: "" };

  const [, lead, detail] = match;
  if (lead.length < MIN_LEAD || lead.length > MAX_LEAD || detail.length < 20) {
    return { lead: trimmed, detail: "" };
  }
  // A lead that is itself a full sentence is not a name.
  if (/[.!?]$/.test(lead.trim())) return { lead: trimmed, detail: "" };

  return { lead: lead.trim(), detail: detail.trim() };
}

/**
 * Splits prose into sentences.
 *
 * Written as a scan rather than a lookbehind regex: Safari before 16.4 treats
 * lookbehind as a syntax error, which takes down the whole bundle rather than
 * just this function.
 */
function sentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!".!?".includes(text[i])) continue;
    // Only a break when whitespace then something that starts a sentence
    // follows, which leaves "e.g." and "3.5" alone.
    const rest = text.slice(i + 1);
    const gap = rest.match(/^\s+/);
    if (!gap) continue;
    const next = rest[gap[0].length];
    if (!next || !/["'A-Z0-9]/.test(next)) continue;
    out.push(text.slice(start, i + 1).trim());
    start = i + 1 + gap[0].length;
    i = start - 1;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * Breaks a block of prose into paragraphs.
 *
 * Existing line breaks are respected first, since the model does sometimes
 * write them. A paragraph that is still very long gets split at sentence
 * boundaries into groups, which is the difference between a scope section
 * that gets read and one that gets scrolled past.
 */
export function paragraphs(text: string, maxChars = 320, perGroup = 2): string[] {
  const blocks = text
    .split(/\n\s*\n|\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const block of blocks) {
    if (block.length <= maxChars) {
      out.push(block);
      continue;
    }
    const parts = sentences(block);
    if (parts.length < 2) {
      out.push(block);
      continue;
    }
    for (let i = 0; i < parts.length; i += perGroup) {
      out.push(parts.slice(i, i + perGroup).join(" ").trim());
    }
  }
  return out.length ? out : [text.trim()];
}
