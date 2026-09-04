import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  planSchema,
  buildPlanPrompt,
  answersForPrompt,
  milestonesForPrompt,
} from "@/lib/quote-plan";
import { ALL_SECTIONS } from "@/lib/quote-defaults";

const plan = planSchema.parse({
  reading: "A two-flow proof of concept for an internal tool nobody is adopting.",
  milestones: [
    { name: "Review and interviews", gate: "Findings agreed", delivers: ["Flow review doc"] },
    { name: "Redesign", gate: "", delivers: ["Figma frames", "Annotations"] },
  ],
  sections: [{ key: "includeTimeline", reason: "Two weeks with a hard handover." }],
  questions: [
    { ask: "How many screens are in the two flows?", assume: "12 screens across 2 flows" },
    { ask: "Who signs off?", assume: "one reviewer" },
  ],
  sightUnseen: true,
});

/**
 * The step between pressing Generate and getting a quote.
 *
 * The old order spent the expensive call first and handed back a finished
 * document, so a misreading could only be corrected by writing the whole thing
 * again. These tests are mostly about the plan being a plan: cheap, correctable
 * and not written in the quote's voice.
 */
describe("the plan", () => {
  it("survives a reply missing everything optional", () => {
    const empty = planSchema.parse({});
    expect(empty.milestones).toEqual([]);
    expect(empty.questions).toEqual([]);
    expect(empty.sightUnseen).toBe(false);
  });

  it("is addressed to the freelancer, not the client", () => {
    const { system } = buildPlanPrompt({
      sourceText: "x",
      language: "English",
      ruleStatements: [],
    });
    expect(system).toContain("You are talking to the freelancer, not to their client");
    expect(system).toContain("never in the voice of a quote");
  });

  it("only offers real section keys", () => {
    const { system } = buildPlanPrompt({
      sourceText: "x",
      language: "English",
      ruleStatements: [],
    });
    for (const key of ALL_SECTIONS) expect(system).toContain(key);
  });

  it("plans around the rules rather than proposing them back", () => {
    // They are already the freelancer's own positions. Offering them as
    // suggestions would be Freely asking somebody to approve their own rule.
    const { user } = buildPlanPrompt({
      sourceText: "x",
      language: "English",
      ruleStatements: ["Invoices are due within 14 days."],
    });
    expect(user).toContain("plan around them rather than proposing them");
    expect(user).toContain("Invoices are due within 14 days.");
  });

  it("asks only about things that would change the work", () => {
    const { system } = buildPlanPrompt({
      sourceText: "x",
      language: "English",
      ruleStatements: [],
    });
    expect(system).toContain("at most four");
    expect(system).toContain("Ask nothing whose answer is already in the brief");
  });

  it("takes the source's own milestones when it has them", () => {
    const { system } = buildPlanPrompt({
      sourceText: "x",
      language: "English",
      ruleStatements: [],
    });
    expect(system).toContain("If the source already names milestones");
  });
});

describe("what the answers become", () => {
  it("turns an answer into a fact", () => {
    const out = answersForPrompt(plan, [
      { ask: "How many screens are in the two flows?", answer: "About 9." },
    ]);
    expect(out).toContain("How many screens are in the two flows? About 9.");
  });

  it("turns a skipped question into a written assumption", () => {
    // The point of naming the assumption up front: a question somebody skipped
    // still lands on the quote in writing rather than as a silent guess.
    const out = answersForPrompt(plan, []);
    expect(out).toContain("Not answered, so assume: 12 screens across 2 flows");
    expect(out).toContain("put it in the assumptions list");
  });

  it("says nothing when there was nothing to ask", () => {
    expect(answersForPrompt(planSchema.parse({}), [])).toBe("");
  });

  it("treats a blank answer as a skip", () => {
    const out = answersForPrompt(plan, [
      { ask: "Who signs off?", answer: "   " },
    ]);
    expect(out).toContain("Not answered, so assume: one reviewer");
  });
});

describe("the milestones the freelancer kept", () => {
  it("sends them as an instruction rather than a suggestion", () => {
    const out = milestonesForPrompt(plan, ["Review and interviews", "Redesign"]);
    expect(out).toContain("use it exactly");
    expect(out).toContain("Do not merge them, split them further, or rename them");
    expect(out).toContain("1. Review and interviews (closes on: Findings agreed)");
  });

  it("drops the ones they unticked", () => {
    const out = milestonesForPrompt(plan, ["Redesign"]);
    expect(out).toContain("Redesign");
    expect(out).not.toContain("Review and interviews");
  });

  it("says nothing when none were kept", () => {
    expect(milestonesForPrompt(plan, [])).toBe("");
  });
});

describe("how the wizard uses it", () => {
  const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");
  const action = readFileSync("src/actions/plan.ts", "utf8");

  it("plans before it writes", () => {
    expect(wizard).toContain("await planQuoteAction(");
    expect(wizard).toContain("setPlan(result.data)");
  });

  it("offers to write the quote when the plan cannot be made, rather than doing it", () => {
    /**
     * A step that can fail must not be a step that blocks, and it used to
     * handle that by silently writing the quote instead. Which made a failure
     * indistinguishable from the step not existing: somebody who saw the plan
     * once and then did not could not tell whether they had done something
     * differently or whether Freely was broken. See tests/plan-failure.
     */
    expect(wizard).toContain("setPlanFailed(result.reason)");
    expect(wizard).toContain("t.quote.writeWithoutPlan");
  });

  it("bills against a split the freelancer just agreed to", () => {
    expect(wizard).toContain('paymentPlan: "MILESTONE" as const');
  });

  it("hides the form while the plan is up", () => {
    // Everything on the form has been answered by this point, and leaving it
    // above would put a wall of controls between the reading and the button.
    expect(wizard).toContain('{tab === "new" && plan && (');
    expect(wizard).toContain('{tab === "new" && !plan && (');
  });

  it("states the rules with their figures filled in", () => {
    expect(action).toContain("ruleWords(rule.key, words).statement.replace(");
  });
});
