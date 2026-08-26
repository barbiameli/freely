import { describe, it, expect } from "vitest";
import {
  INVOICE_NOTES,
  hasNote,
  toggleNote,
  noteIdForDays,
  alignDueNote,
  DUE_NOTE_IDS,
} from "@/lib/invoice-notes";

describe("the list itself", () => {
  it("has no duplicate ids", () => {
    const ids = INVOICE_NOTES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate text, since two chips adding the same line is a bug", () => {
    const texts = INVOICE_NOTES.map((n) => n.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  // A line with a newline in it would break the add and remove, both of which
  // work a line at a time.
  it("keeps every line to one line", () => {
    for (const note of INVOICE_NOTES) expect(note.text).not.toMatch(/\n/);
  });

  it("names a due-date line for each of the common terms", () => {
    for (const id of DUE_NOTE_IDS) {
      expect(INVOICE_NOTES.some((n) => n.id === id), id).toBe(true);
    }
  });
});

describe("toggleNote", () => {
  it("adds to an empty note", () => {
    expect(toggleNote("", "thanks")).toBe("Thank you for the work, it has been a pleasure.");
  });

  it("appends to what is already there", () => {
    const first = toggleNote("", "due-14");
    const both = toggleNote(first, "thanks");
    expect(both.split("\n")).toHaveLength(2);
    expect(both.startsWith("Payment is due within 14 days")).toBe(true);
  });

  it("takes a line away again", () => {
    const added = toggleNote("", "due-14");
    expect(toggleNote(added, "due-14")).toBe("");
  });

  it("removes from the middle without leaving a gap", () => {
    let text = toggleNote("", "due-14");
    text = toggleNote(text, "late");
    text = toggleNote(text, "thanks");
    const without = toggleNote(text, "late");
    expect(without.split("\n")).toHaveLength(2);
    expect(without).not.toMatch(/\n\n/);
  });

  it("adding twice does nothing the second time", () => {
    const once = toggleNote("", "thanks");
    expect(toggleNote(toggleNote(once, "thanks"), "thanks")).toBe(once);
  });

  it("leaves an unknown id alone", () => {
    expect(toggleNote("Something written by hand.", "nope")).toBe("Something written by hand.");
  });

  it("keeps anything typed by hand", () => {
    const typed = "Please send remittance advice.";
    expect(toggleNote(typed, "thanks")).toMatch(/^Please send remittance advice\./);
  });
});

describe("hasNote", () => {
  it("sees a line that is there", () => {
    expect(hasNote(toggleNote("", "late"), "late")).toBe(true);
  });

  // Once the words are theirs, the chip is no longer describing what is in
  // the box, and pretending otherwise would let a toggle delete their edit.
  it("stops counting a line somebody has edited", () => {
    const edited = "Payment is due within 14 days of invoice date, no exceptions.";
    expect(hasNote(edited, "due-14")).toBe(false);
  });

  it("is false for an unknown id", () => {
    expect(hasNote("anything", "nope")).toBe(false);
  });
});

describe("noteIdForDays", () => {
  it("knows the common terms", () => {
    expect(noteIdForDays(14)).toBe("due-14");
    expect(noteIdForDays(30)).toBe("due-30");
    expect(noteIdForDays(0)).toBe("on-receipt");
  });

  it("has no line for an unusual term", () => {
    expect(noteIdForDays(21)).toBeNull();
  });
});

describe("alignDueNote", () => {
  // The worst outcome available here: an invoice saying 30 days at the bottom
  // and showing a date two weeks away at the top.
  it("swaps the line when the due date changes", () => {
    const text = toggleNote("", "due-14");
    expect(alignDueNote(text, 30)).toBe("Payment is due within 30 days of the invoice date.");
  });

  it("leaves the note alone when no due line was chosen", () => {
    const text = toggleNote("", "thanks");
    expect(alignDueNote(text, 30)).toBe(text);
  });

  // Silently dropping it would lose something chosen on purpose, but keeping
  // it would state a term the invoice contradicts.
  it("removes the line when the new term has no wording", () => {
    const text = toggleNote("", "due-14");
    expect(alignDueNote(text, 21)).toBe("");
  });

  it("keeps the other lines while it swaps", () => {
    let text = toggleNote("", "due-14");
    text = toggleNote(text, "thanks");
    const aligned = alignDueNote(text, 30);
    expect(aligned).toMatch(/Thank you/);
    expect(aligned).toMatch(/30 days/);
    expect(aligned).not.toMatch(/14 days/);
  });
});
