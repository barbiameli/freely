/**
 * The lines that go at the foot of an invoice.
 *
 * The closing note was an empty box with a label and nothing else. Everything
 * that actually belongs there is the same on every invoice a person sends and
 * none of it is obvious: when payment is due, what happens if it is late, who
 * accounts for the tax. So the box got left blank, and an invoice with no
 * payment term is the one that gets paid whenever.
 *
 * These are lines to tap rather than a paragraph to write, the same way the
 * quote sections work. Tapping one adds it, tapping again removes it, and the
 * text stays editable underneath, because a preset that cannot be changed is a
 * template and this is somebody's own wording.
 *
 * Nothing here is legal advice and none of it is jurisdiction-specific. The
 * reverse charge line is the one exception and it says so, because getting it
 * wrong is an actual tax problem rather than an untidy invoice.
 */

export interface InvoiceNote {
  /** Stable, so a saved choice survives the wording being improved. */
  id: string;
  label: string;
  text: string;
}

/** How long is usually given to pay, for the due-date presets. */
export const COMMON_TERMS_DAYS = [7, 14, 30] as const;

export const INVOICE_NOTES: InvoiceNote[] = [
  {
    id: "due-14",
    label: "Due in 14 days",
    text: "Payment is due within 14 days of the invoice date.",
  },
  {
    id: "due-30",
    label: "Due in 30 days",
    text: "Payment is due within 30 days of the invoice date.",
  },
  {
    id: "on-receipt",
    label: "Due on receipt",
    text: "Payment is due on receipt of this invoice.",
  },
  {
    id: "late",
    label: "Late payment",
    text: "Invoices unpaid after the due date may carry interest at the statutory rate.",
  },
  {
    id: "reference",
    label: "Use the invoice number",
    text: "Please quote the invoice number with your payment so it can be matched.",
  },
  {
    id: "reverse-charge",
    label: "Reverse charge",
    text: "VAT reverse charge applies. The customer accounts for VAT to the relevant tax authority.",
  },
  {
    id: "thanks",
    label: "Thank you",
    text: "Thank you for the work, it has been a pleasure.",
  },
  {
    id: "queries",
    label: "Any questions",
    text: "Any questions about this invoice, just reply to this email and I will sort it out.",
  },
];

const BY_ID = new Map(INVOICE_NOTES.map((note) => [note.id, note]));

/**
 * Whether a line is already in the note.
 *
 * Compared on the exact text, so a line somebody has since edited stops
 * counting as the preset. That is the honest answer: once the words are
 * theirs, the chip is no longer describing what is in the box.
 */
export function hasNote(text: string, id: string): boolean {
  const note = BY_ID.get(id);
  if (!note) return false;
  return text.split("\n").some((line) => line.trim() === note.text);
}

/**
 * Adds a line, or takes it away.
 *
 * Appended rather than inserted in a fixed order, so the note reads in the
 * order somebody built it. Adding the same line twice does nothing.
 */
export function toggleNote(text: string, id: string): string {
  const note = BY_ID.get(id);
  if (!note) return text;

  if (hasNote(text, id)) {
    return text
      .split("\n")
      .filter((line) => line.trim() !== note.text)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const trimmed = text.trim();
  return trimmed ? `${trimmed}\n${note.text}` : note.text;
}

/**
 * The due-date line for a number of days, if there is one.
 *
 * Used to keep the note and the due date from contradicting each other, which
 * is the worst outcome available here: an invoice that says 30 days at the
 * bottom and shows a date two weeks away at the top is one the client is
 * entitled to ignore.
 */
export function noteIdForDays(days: number): string | null {
  if (days === 14) return "due-14";
  if (days === 30) return "due-30";
  if (days === 0) return "on-receipt";
  return null;
}

/** Every due-date line, since only one of them can be true at a time. */
export const DUE_NOTE_IDS = ["due-14", "due-30", "on-receipt"];

/**
 * Swaps whichever due-date line is present for the one that matches.
 *
 * Called when the due date changes. Leaving the old line behind would state a
 * term the invoice contradicts, and silently dropping it would lose something
 * somebody chose on purpose.
 */
export function alignDueNote(text: string, days: number): string {
  const wanted = noteIdForDays(days);
  const present = DUE_NOTE_IDS.filter((id) => hasNote(text, id));
  if (present.length === 0) return text;

  let next = text;
  for (const id of present) next = toggleNote(next, id);
  return wanted ? toggleNote(next, wanted) : next;
}
