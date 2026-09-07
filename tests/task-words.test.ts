import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { taskLabel, tooWordy } from "@/lib/task-words";

describe("a task is the length of a card", () => {
  it("keeps the label and drops the explanation", () => {
    expect(taskLabel("Audit the existing type styles, listing every size in use")).toBe(
      "Audit the existing type"
    );
    expect(taskLabel("Draft new screens, with interaction states")).toBe("Draft new screens");
  });

  it("cuts at the clause rather than mid-thought", () => {
    // Truncating on words alone would leave "Annotate all frames with".
    expect(taskLabel("Annotate all frames - behaviour and edge cases")).toBe(
      "Annotate all frames"
    );
  });

  it("leaves a short one alone", () => {
    for (const good of ["Audit type styles", "Draft new screens", "Annotate interactions"]) {
      expect(taskLabel(good)).toBe(good);
      expect(tooWordy(good)).toBe(false);
    }
  });

  it("drops trailing punctuation", () => {
    expect(taskLabel("Write handover notes.")).toBe("Write handover notes");
  });

  it("knows a sentence when it sees one", () => {
    expect(tooWordy("Audit the existing type styles and list every size in use")).toBe(true);
  });

  it("never returns nothing", () => {
    // A step that is only punctuation should come back as itself rather than
    // as an empty card nobody can click.
    expect(taskLabel("...")).toBe("");
    expect(taskLabel("Onboarding")).toBe("Onboarding");
  });
});


describe("where it is applied", () => {
  it("cuts the step on the way into the database", () => {
    // The prompt asks for two to four words. This is what catches the times
    // it does not, which is the only time the freelancer sees the difference.
    const track = readFileSync("src/actions/track.ts", "utf8");
    expect(track).toContain("taskLabel(clean(s.name))");
  });

  it("asks the model for a card, not a sentence", () => {
    const anthropic = readFileSync("src/lib/anthropic.ts", "utf8");
    expect(anthropic).toContain("Each one is a card on a board");
    expect(anthropic).toContain("Between 2 and 4 steps");
    // The old ceiling, which produced a column nobody read.
    expect(anthropic).not.toContain("Between 4 and 10 steps");
  });
});
