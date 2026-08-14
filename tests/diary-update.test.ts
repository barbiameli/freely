import { describe, it, expect } from "vitest";
import {
  shareableItems,
  composeUpdate,
  hasAnythingToSend,
  type ShareItem,
  type UpdateSource,
  type UpdateWords,
} from "@/lib/diary-update";

const SOURCE: UpdateSource = {
  deliverables: [
    { id: "d1", name: "Site audit", done: true },
    { id: "d2", name: "Font swap", done: true },
    { id: "d3", name: "Revision round", done: false },
  ],
  questions: [{ id: "f1", question: "Has Sohne been purchased?" }],
  dueLabel: "20 Aug",
};

const WORDS: UpdateWords = {
  progress: "{done} of {total} done",
  finished: "Finished",
  stillToCome: "Still to come",
  questionsForYou: "A couple of things I need from you",
  due: "Due {date}.",
  title: "Progress update",
};

function on(items: ShareItem[], predicate: (i: ShareItem) => boolean, value: boolean) {
  return items.map((i) => (predicate(i) ? { ...i, on: value } : i));
}

describe("shareableItems", () => {
  it("lists everything that could go to the client", () => {
    const items = shareableItems(SOURCE);
    expect(items.map((i) => i.kind)).toEqual([
      "PROGRESS",
      "DONE",
      "DONE",
      "TODO",
      "DUE",
      "QUESTION",
    ]);
  });

  it("includes everything by default except the questions", () => {
    // A question in tracker wording reads as an internal note, and half of them
    // are notes to self. Opting in is the right way round.
    const items = shareableItems(SOURCE);
    expect(items.filter((i) => !i.on).map((i) => i.kind)).toEqual(["QUESTION"]);
  });

  it("names the deliverables rather than counting them", () => {
    // The actual bug: the old version sent "2 of 4 deliverables complete so
    // far" and nothing that had been ticked appeared anywhere in it.
    const items = shareableItems(SOURCE);
    expect(items.filter((i) => i.kind === "DONE").map((i) => i.text)).toEqual([
      "Site audit",
      "Font swap",
    ]);
  });

  it("has nothing to offer for a project with no deliverables", () => {
    const items = shareableItems({ deliverables: [], questions: [], dueLabel: null });
    expect(items).toEqual([]);
  });
});

describe("composeUpdate", () => {
  it("writes what was ticked, by name", () => {
    const { title, body } = composeUpdate(shareableItems(SOURCE), SOURCE, WORDS);
    expect(title).toBe("Progress update");
    expect(body).toContain("Finished: Site audit, Font swap.");
    expect(body).toContain("Still to come: Revision round.");
    expect(body).toContain("Due 20 Aug.");
  });

  it("leaves the questions out unless they were turned on", () => {
    const { body } = composeUpdate(shareableItems(SOURCE), SOURCE, WORDS);
    expect(body).not.toContain("Sohne");
  });

  it("includes a question once it is turned on", () => {
    const items = on(shareableItems(SOURCE), (i) => i.kind === "QUESTION", true);
    expect(composeUpdate(items, SOURCE, WORDS).body).toContain("Has Sohne been purchased?");
  });

  it("keeps the count honest when something is excluded", () => {
    // Excluding a deliverable and leaving "2 of 3 done" above the two names
    // that remain would have the client counting a thing they cannot see.
    const items = on(shareableItems(SOURCE), (i) => i.id === "todo:d3", false);
    expect(composeUpdate(items, SOURCE, WORDS).body).toContain("2 of 2 done");
  });

  it("drops a section entirely rather than heading an empty one", () => {
    const items = on(shareableItems(SOURCE), (i) => i.kind === "DONE", false);
    const { body } = composeUpdate(items, SOURCE, WORDS);
    expect(body).not.toContain("Finished");
    expect(body).toContain("Still to come");
  });

  it("says nothing about the status enum, ever", () => {
    // The old line ended "Status: ACTIVE", which is a database value in front
    // of somebody paying an invoice.
    const { body } = composeUpdate(shareableItems(SOURCE), SOURCE, WORDS);
    expect(body).not.toMatch(/ACTIVE|status/i);
  });

  it("separates the parts with blank lines, since the diary renders paragraphs", () => {
    const { body } = composeUpdate(shareableItems(SOURCE), SOURCE, WORDS);
    expect(body).toContain("\n\n");
  });
});

describe("hasAnythingToSend", () => {
  it("does not count the progress line on its own", () => {
    // "0 of 0 done" with everything else off tells a client you opened the app.
    const items = on(shareableItems(SOURCE), (i) => i.kind !== "PROGRESS", false);
    expect(hasAnythingToSend(items)).toBe(false);
  });

  it("is happy with a single named deliverable", () => {
    const items = on(
      on(shareableItems(SOURCE), () => true, false),
      (i) => i.id === "done:d1",
      true
    );
    expect(hasAnythingToSend(items)).toBe(true);
  });
});
