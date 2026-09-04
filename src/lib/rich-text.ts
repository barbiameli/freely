import { isPositionLabel } from "@/lib/deliverable-check";
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
  // Nor is a position. "Milestone 1" and "End of Week 2" say where something
  // sits, not what it is, and promoting one to the heading is how six
  // deliverables came to be titled "Milestone 1" three times and "Milestone 2"
  // three times, with the actual artifact demoted to the small grey line.
  if (isPositionLabel(lead)) return { lead: trimmed, detail: "" };

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

/**
 * A paragraph that begins with a stage label, split from its prose.
 *
 * Kick-off updates come out as "Week 1: Audit and access - you share login
 * access to the site backend..." and the client reads the whole thing as one
 * grey slab. The label is doing the work of a heading and should look like one,
 * so it gets pulled out and set in bold.
 */
export interface LabelledBlock {
  /** "Week 1", "Phase 2", "Semana 2-3", or empty when the block has no label. */
  label: string;
  /** The short lead after the label, when there is one worth setting apart. */
  lead: string;
  /** Everything else. */
  body: string;
}

/**
 * Both languages, because a Spanish quote produces Spanish updates. Anchored,
 * capped at three words before the colon, and requiring a digit, so a sentence
 * that happens to contain a colon is left alone.
 */
const STAGE_LABEL =
  /^((?:week|weeks|phase|stage|month|sprint|day|semana|semanas|fase|etapa|mes|día|dia)\s*\d+(?:\s*(?:-|–|to|a|y|and)\s*\d+)?)\s*[:.]\s*/i;

/**
 * Splits one paragraph into label, lead and body.
 *
 * The lead is only taken when the text after the label reads like a name for
 * the stage: short, no sentence-ending punctuation, and followed by more. A
 * paragraph that is one long sentence keeps it all as body, because bolding
 * half a sentence is worse than bolding none of it.
 */
export function splitLabelled(text: string): LabelledBlock {
  const trimmed = text.trim();
  const match = trimmed.match(STAGE_LABEL);
  if (!match) return { label: "", lead: "", body: trimmed };

  const label = match[1].trim();
  const rest = trimmed.slice(match[0].length).trim();

  const dash = rest.match(/^([^\n]{4,60}?)\s+[-–]\s+([\s\S]+)$/);
  if (dash && !/[.!?]$/.test(dash[1])) {
    return { label, lead: dash[1].trim(), body: dash[2].trim() };
  }
  return { label, lead: "", body: rest };
}

/**
 * Puts each stage on its own line.
 *
 * Timelines arrive as one run of text: "...before any design work starts. Week
 * 2-3: Checkout and mobile fixes - redesign..." Splitting that by sentence count
 * puts a stage heading halfway down a paragraph, so the breaks are put where the
 * stages are first.
 *
 * Done when rendering rather than when saving, so updates already written come
 * out right too.
 */
function breakAtStages(text: string): string {
  return text.replace(
    /(?!^)\s+((?:week|weeks|phase|stage|month|sprint|semana|semanas|fase|etapa|mes)\s*\d+(?:\s*(?:-|–|to|a|y|and)\s*\d+)?\s*[:.])/gi,
    "\n$1"
  );
}

/**
 * A whole update, as blocks ready to render.
 *
 * Stage breaks, then paragraphs, then labels, in one call, since every place
 * that shows an update wants all three and doing them separately is how the
 * diary and the client page ended up formatting the same text two different
 * ways.
 */
export function updateBlocks(text: string): LabelledBlock[] {
  return paragraphs(breakAtStages(text)).map(splitLabelled);
}

/**
 * Forces a generated title to be a title.
 *
 * The prompt asks for two to five words and the model sometimes returns the
 * whole sentence anyway, so the rule is enforced here rather than hoped for:
 * first line only, no trailing punctuation, and anything still long falls back
 * to the leading clause. A heading that wraps to three lines is not a heading.
 */
export function tidyTitle(text: string, max = 52): string {
  const firstLine = text.split("\n")[0].trim().replace(/[.,;:]+$/, "");
  if (firstLine.length <= max) return firstLine;

  const { lead } = splitDeliverable(firstLine);
  const candidate = lead.replace(/[.,;:]+$/, "");
  if (candidate.length <= max) return candidate;

  // Cut on a word boundary rather than mid-word.
  const cut = candidate.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

/**
 * Whether a summary is just the title again.
 *
 * The model sometimes returns both saying the same thing, which showed up as
 * the same sentence twice in a row. Compared on words rather than characters
 * so a reworded-but-identical pair still counts.
 */
export function summaryRepeatsTitle(summary: string, title: string): boolean {
  const normalise = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);
  const s = normalise(summary);
  const t = normalise(title);
  if (t.length === 0 || s.length === 0) return false;
  // A summary that opens with the whole title, or is a near-identical set of
  // words, is a repeat.
  if (s.slice(0, t.length).join(" ") === t.join(" ")) return true;
  const shared = t.filter((word) => s.includes(word)).length;
  return shared / t.length > 0.85 && Math.abs(s.length - t.length) <= 3;
}
