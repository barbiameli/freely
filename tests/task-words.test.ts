import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { taskLabel, tooWordy } from "@/lib/task-words";

describe("a task is the length of a card", () => {
  it("leaves a real step alone, even a longer one", () => {
    // The first version capped at four words and turned this into
    // "Sketch flows for both", which is not a thing anyone would write.
    for (const good of [
      "Audit type styles",
      "Sketch flows for both journeys",
      "Organise information on each screen",
      "Name layers and tidy the file",
    ]) {
      expect(taskLabel(good)).toBe(good);
      expect(tooWordy(good)).toBe(false);
    }
  });

  it("cuts a sentence at its clause", () => {
    expect(taskLabel("Audit the existing type styles, listing every size in use")).toBe(
      "Audit the existing type styles"
    );
    expect(taskLabel("Annotate all frames - behaviour and edge cases")).toBe(
      "Annotate all frames"
    );
  });

  it("still cuts when there is no clause to cut at", () => {
    const rambling = "Go through every single screen in the file and check the spacing carefully";
    expect(taskLabel(rambling).split(/\s+/).length).toBe(8);
  });

  it("drops trailing punctuation", () => {
    expect(taskLabel("Write handover notes.")).toBe("Write handover notes");
  });

  it("knows a paragraph when it sees one", () => {
    expect(
      tooWordy("Audit the existing type styles and list every size in use across the file")
    ).toBe(true);
  });

  it("never returns nothing useful", () => {
    expect(taskLabel("...")).toBe("");
    expect(taskLabel("Onboarding")).toBe("Onboarding");
  });
});

describe("where it is applied", () => {
  it("cuts the step on the way into the database", () => {
    const track = readFileSync("src/actions/track.ts", "utf8");
    expect(track).toContain("taskLabel(clean(s.name))");
  });

  it("asks the model to judge how many rather than hit a number", () => {
    // It was "Between 2 and 4 steps", so every deliverable came back with
    // three whether it had three moves in it or eight.
    const anthropic = readFileSync("src/lib/anthropic.ts", "utf8");
    expect(anthropic).toContain("How many is a judgement, not a number");
    expect(anthropic).toContain("Somewhere between 2 and 10");
    expect(anthropic).not.toContain("Between 2 and 4 steps");
    expect(anthropic).not.toContain("Between 4 and 10 steps");
  });

  it("still refuses a paragraph", () => {
    const anthropic = readFileSync("src/lib/anthropic.ts", "utf8");
    expect(anthropic).toContain("Two to eight words");
  });
});

describe("the second rail is gone", () => {
  const detail = readFileSync("src/app/(app)/track/[projectId]/project-detail.tsx", "utf8");

  it("does not spend a column on a list of other projects", () => {
    // It sat there permanently, a sixth of the width, answering "which other
    // projects exist" while somebody was trying to work on this one, and put
    // a second vertical rail beside the app's own.
    expect(detail).not.toContain('lg:w-[172px]');
    expect(detail).not.toContain("flex flex-col lg:flex-row gap-5 lg:gap-6 flex-1 min-h-0");
  });

  it("keeps a way to reach the other projects", () => {
    expect(detail).toContain("projectList.map");
    expect(detail).toContain("t.track.allProjects");
  });
});

describe("the rail uses icons", () => {
  const sidebar = readFileSync("src/components/sidebar.tsx", "utf8");

  it("has no initials left", () => {
    // "H Q T I M" only works once you have learned it, and it was never
    // translated: the Spanish rail read the same five English initials.
    expect(sidebar).not.toContain('glyph: "H"');
    expect(sidebar).not.toContain("{item.glyph}");
  });

  it("gives every destination an icon", () => {
    // The product's own drawn set where one exists, and a stock glyph where
    // it does not yet.
    for (const icon of ["House", "IconQuote", "IconTrack", "Receipt", "IconMemory", "IconClient"]) {
      expect(sidebar).toContain(icon);
    }
  });
});
