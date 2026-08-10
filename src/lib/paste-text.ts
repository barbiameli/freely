/**
 * Turns pasted rich text into readable plain text.
 *
 * Briefs usually arrive from a Google Doc, Word, Notion or an email, where the
 * structure is carried by headings, paragraphs and bullets. Pasting into a
 * plain textarea throws all of that away and leaves one long block, which is
 * hard to read back and gives the model less to work with.
 *
 * The clipboard carries an HTML flavour alongside the plain text, so this
 * reads that and rebuilds the structure as line breaks and "- " bullets.
 */

/** Block-level tags that should end up on their own line. */
const BLOCK_TAGS = new Set([
  "P",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "SECTION",
  "ARTICLE",
  "TR",
  "PRE",
]);

function walk(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    // Collapse the runs of whitespace that HTML sources are full of, but keep
    // a single space so words don't run together.
    const text = (node.textContent || "").replace(/\s+/g, " ");
    if (text.trim()) out.push(text);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName;

  if (tag === "BR") {
    out.push("\n");
    return;
  }
  if (tag === "LI") {
    out.push("\n- ");
    el.childNodes.forEach((child) => walk(child, out));
    return;
  }
  if (BLOCK_TAGS.has(tag)) {
    out.push("\n");
    el.childNodes.forEach((child) => walk(child, out));
    out.push("\n");
    return;
  }
  el.childNodes.forEach((child) => walk(child, out));
}

/** Converts an HTML clipboard payload into plain text with structure kept. */
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: string[] = [];
  doc.body.childNodes.forEach((node) => walk(node, out));
  return tidy(out.join(""));
}

/** Normalises whitespace without flattening the paragraph structure. */
export function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    // Trailing spaces before a break add nothing.
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    // Three or more blank lines is never meaningful.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Reads the best available flavour from a paste event.
 *
 * Returns null when there's nothing worth substituting, so the caller can let
 * the browser handle the paste itself.
 */
export function readPastedText(clipboard: DataTransfer): string | null {
  const html = clipboard.getData("text/html");
  if (html) {
    const converted = htmlToPlainText(html);
    if (converted) return converted;
  }
  const plain = clipboard.getData("text/plain");
  return plain ? tidy(plain) : null;
}
