import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A plan that could not be made says so.
 *
 * The wizard used to fall straight through to writing the quote when the plan
 * step failed, so a brief too short to read, a busy minute and a genuine
 * failure all looked identical from the outside: they looked like the step not
 * existing. Somebody who saw the plan once and then did not had no way to tell
 * whether they had done something differently or whether Freely was broken.
 */
const action = readFileSync("src/actions/plan.ts", "utf8");
const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");

describe("why there is no plan", () => {
  it("names the three reasons apart", () => {
    expect(action).toContain('export type PlanFailure = "tooShort" | "busy" | "unreadable"');
  });

  it("does not let a queue read as an unreadable brief", () => {
    // One is worth waiting a moment for and the other is not.
    expect(action).toContain('reason: "busy"');
    expect(action).toContain("Separated from the catch below");
  });

  it("says when there is simply not enough to read yet", () => {
    expect(action).toContain('reason: "tooShort"');
    expect(action).toContain("const MIN_BRIEF = 120;");
  });

  it("logs a real failure rather than swallowing it", () => {
    // Otherwise the next report of this is as hard to diagnose as the first.
    expect(action).toContain('console.error("[planQuoteAction] failed", err)');
  });
});

describe("what the wizard does about it", () => {
  it("no longer writes the quote behind your back", () => {
    expect(wizard).toContain("setPlanFailed(result.reason)");
    expect(wizard).not.toContain("    await writeQuote();\n  }");
  });

  it("offers both ways on, rather than choosing one", () => {
    // Waiting a moment is right for a queue and pointless for a brief with
    // four words in it.
    expect(wizard).toContain("t.quote.writeWithoutPlan");
    expect(wizard).toContain('planFailed === "busy"');
  });

  it("clears the failure when you try again", () => {
    expect(wizard).toContain("setPlanFailed(null)");
  });
});

describe("trying a brief without writing a quote", () => {
  const testing = readFileSync("src/actions/testing.ts", "utf8");
  const card = readFileSync("src/app/(app)/insights/reading-card.tsx", "utf8");

  it("runs the same call the wizard runs", () => {
    // A workbench that tests something adjacent to the real thing teaches you
    // about the workbench.
    expect(testing).toContain("await planQuoteAction(input)");
  });

  it("writes nothing down", () => {
    // Tuning the prompt used to mean a stored brief, a client record and a row
    // in the list, every time, to look at a paragraph.
    const block = testing.slice(testing.indexOf("tryReadingAction"));
    expect(block).not.toContain("prisma.brief.create");
    expect(block).not.toContain("clientFor");
  });

  it("is admin only", () => {
    expect(testing.slice(testing.indexOf("tryReadingAction"))).toContain("await requireAdmin()");
  });

  it("reports which failure happened rather than an empty result", () => {
    // Which of the three it was is most of what there is to learn.
    expect(testing).toContain("reason: result.reason");
    expect(card).toContain("Reason: {reason}".replace("{reason}", ""));
  });

  it("shows the answer raw", () => {
    // A prettier rendering would hide the thing being debugged: an empty
    // array, a section key that does not exist, a risk in the wrong voice.
    expect(card).toContain("JSON.stringify(result.plan, null, 2)");
  });

  it("says how long it took", () => {
    expect(testing).toContain("const ms = Date.now() - startedAt;");
  });
});
