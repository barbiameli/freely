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
    expect(action).toContain(
      'export type PlanFailure = "tooShort" | "busy" | "unreadable" | "tooLong"'
    );
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

/**
 * The three ways the model itself fails are also three different sentences.
 *
 * planQuote returned `QuotePlan | null`, so a response that ran out of room
 * mid-JSON, a response with no JSON in it and a response the schema rejected
 * all arrived as null, and every one of them told the freelancer "Couldn't
 * make sense of that brief". Two of those are not about the brief at all.
 */
describe("which failure it was", () => {
  const anthropic = readFileSync("src/lib/anthropic.ts", "utf8");

  it("returns a reason rather than null", () => {
    expect(anthropic).toContain("export type PlanResult");
    expect(anthropic).not.toContain("}): Promise<QuotePlan | null> {");
  });

  it("separates being cut off from being unreadable", () => {
    expect(anthropic).toContain('reason: cutOff ? "tooLong" : "unreadable"');
  });

  it("logs why the schema rejected a plan", () => {
    // Without this the only evidence of a changed field was a freelancer
    // being told their brief made no sense.
    expect(anthropic).toContain("[planQuote] failed validation");
  });

  it("leaves room for the plan of a long brief", () => {
    // 1600 was not enough for a reading, stages, sections, questions, money
    // asks and risks together, and running out looked like an unreadable brief.
    const plan = anthropic.slice(anthropic.indexOf("export async function planQuote"));
    expect(plan).toContain('callClaude("planQuote", system, user, { maxTokens: 3000 })');
  });

  it("offers a retry on the failures that deserve one", () => {
    // Being cut off is worth another go. An unreadable brief is not.
    expect(wizard).toContain('planFailed === "busy" || planFailed === "tooLong"');
  });

  it("says it once", () => {
    // The same sentence in red above and in grey below reads as two faults.
    expect(wizard).toContain("{error && !planFailed && <div");
  });
});

/**
 * One bad optional field does not take the quote with it.
 *
 * Asking a refine to add a milestone section produced an object where the
 * schema wanted an array, and the whole response was rejected: the scope, the
 * deliverables and the payment terms that had just been corrected all went
 * with it, and the freelancer was shown "Brief response failed validation:
 * expected array".
 */
describe("a malformed milestones field", () => {
  const anthropic = readFileSync("src/lib/anthropic.ts", "utf8");
  const field = anthropic.slice(anthropic.indexOf("milestones: z"), anthropic.indexOf("milestones: z") + 400);

  it("is dropped rather than fatal", () => {
    expect(field).toContain(".catch(undefined)");
  });

  it("drops one bad stage rather than all of them", () => {
    expect(field).toContain("milestoneSchema.nullable().catch(null)");
  });
});
