import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { planCards, decisionCount, type PlanShape } from "@/lib/plan-signals";

const calm: PlanShape = {
  conflictCount: 0,
  overridesPayment: false,
  protection: "NEW",
  fromHistory: false,
  sightUnseen: false,
  questionCount: 2,
  milestoneCount: 2,
  phased: true,
  sectionCount: 4,
  ruleCount: 8,
};

describe("what the plan screen is made of", () => {
  it("puts the things that need an answer first", () => {
    const cards = planCards({ ...calm, conflictCount: 2, sightUnseen: true });
    const levels = cards.map((c) => c.level);
    // Never a settled card above a decision.
    expect(levels.indexOf("settled")).toBeGreaterThan(levels.lastIndexOf("decide"));
  });

  it("treats money the client asked for as a decision", () => {
    const cards = planCards({ ...calm, conflictCount: 1 });
    const conflicts = cards.find((c) => c.key === "conflicts");
    expect(conflicts).toMatchObject({ level: "decide", source: "brief" });
  });

  it("leaves out a card with nothing in it", () => {
    const bare = planCards({ ...calm, conflictCount: 0, questionCount: 0, ruleCount: 0 });
    expect(bare.map((c) => c.key)).not.toContain("conflicts");
    expect(bare.map((c) => c.key)).not.toContain("questions");
    expect(bare.map((c) => c.key)).not.toContain("rules");
  });

  it("raises the protection card only when it changes something", () => {
    expect(planCards(calm).find((c) => c.key === "protection")?.level).toBe("check");
    expect(
      planCards({ ...calm, overridesPayment: true }).find((c) => c.key === "protection")?.level
    ).toBe("decide");
    expect(
      planCards({ ...calm, protection: "GUARDED" }).find((c) => c.key === "protection")?.level
    ).toBe("decide");
  });

  it("says where the protection level came from", () => {
    // "You have worked with them three times" is a different claim from
    // "this brief looks risky", and the freelancer can only judge the second.
    expect(planCards({ ...calm, fromHistory: true }).find((c) => c.key === "protection")?.source)
      .toBe("history");
    expect(planCards(calm).find((c) => c.key === "protection")?.source).toBe("brief");
  });

  it("makes the questions a decision when nobody has seen the thing", () => {
    expect(planCards(calm).find((c) => c.key === "questions")?.level).toBe("check");
    expect(
      planCards({ ...calm, sightUnseen: true }).find((c) => c.key === "questions")?.level
    ).toBe("decide");
  });

  it("keeps the reading and the rules out of the decisions column", () => {
    for (const card of planCards(calm)) {
      const isReadOnly = card.key === "reading" || card.key === "rules";
      expect(card.column).toBe(isReadOnly ? "context" : "decide");
    }
  });

  it("hides the stages when the work is one phase", () => {
    expect(planCards({ ...calm, phased: false }).map((c) => c.key)).not.toContain("milestones");
  });

  it("counts what needs you", () => {
    expect(decisionCount(planCards(calm))).toBe(0);
    expect(decisionCount(planCards({ ...calm, conflictCount: 2, sightUnseen: true }))).toBe(2);
  });
});

/**
 * Running in stages and paying per stage are two questions.
 *
 * The generate prompt asked for a milestones array only when the payment plan
 * was MILESTONE, so choosing "in stages" and "just the shape of the work"
 * produced no milestones at all. The stages had nowhere to go, so the model
 * wrote them into the timeline, and the quote's payment terms, revisions,
 * assumptions and cancellation clause all referred to "Milestone 1" and
 * "Milestone 2" while no milestone section existed on the document.
 */
describe("stages get a section of their own", () => {
  const anthropic = readFileSync("src/lib/anthropic.ts", "utf8");

  it("asks for stages whenever the work runs in them", () => {
    expect(anthropic).toContain("const runsInStages =");
    expect(anthropic).toContain("const milestoneInstruction = runsInStages");
    // The old gate, which read the payment plan to answer a question about shape.
    expect(anthropic).not.toContain('const milestoneInstruction = draft.paymentPlan === "MILESTONE"');
  });

  it("puts no amounts on stages that are not payment points", () => {
    expect(anthropic).toContain("const stagesArePaid =");
    expect(anthropic).toContain("they carry no amounts");
  });

  it("stops the timeline restating the stages", () => {
    // Both sections were asking for the same staged breakdown, so the quote
    // said it twice and the client could not tell which was the schedule.
    expect(anthropic).toContain("timelineDefersToStages");
    expect(anthropic).toContain("Do not repeat that structure here.");
  });
});

/**
 * Stages existed in three places and were hidden by all three.
 *
 * The prompt's authoritative schema never listed "milestones" while a separate
 * paragraph asked for one, so the model was told to match a schema without
 * stages and produce stages at the same time. What did come back was saved
 * behind useMilestones, a flag set from the payment plan. And every reader in
 * the app went through milestonesFromSettings, which returned nothing unless
 * that same flag was true. A quote could run in stages, say so in its payment
 * terms, its revisions and its cancellation clause, and have no stages
 * anywhere on the page.
 */
describe("stages survive being written down", () => {
  const anthropic = readFileSync("src/lib/anthropic.ts", "utf8");
  const lines = readFileSync("src/lib/milestone-lines.ts", "utf8");
  const actions = readFileSync("src/actions/briefs.ts", "utf8");
  const milestones = readFileSync("src/lib/milestones.ts", "utf8");

  it("names the key in the schema the model is told to match", () => {
    const schema = anthropic.slice(anthropic.indexOf("matching exactly this schema"));
    expect(schema.slice(0, 1200)).toContain('"milestones"');
  });

  it("keeps the guard, on a flag that means having stages", () => {
    // The guard is right: a leftover array from a plan somebody changed their
    // mind about must not put stages on a quote that has none. What was wrong
    // was the flag, which was set from the payment plan.
    expect(lines).toContain("if (!parsed.useMilestones) return [];");
    expect(lines).toContain("rather than that it bills by them");
  });

  it("records that a quote has stages, not that it bills by them", () => {
    expect(actions).toContain("useMilestones: Boolean(generated.milestones?.length)");
    expect(actions).not.toContain('useMilestones: draft.paymentPlan === "MILESTONE"');
  });

  it("leaves shape-only stages without amounts", () => {
    // balanceAmounts spread the whole price across them regardless, which
    // invents the payment schedule the plan step exists to avoid.
    expect(milestones).toContain("billable = true");
    expect(milestones).toContain("withWork.map((milestone) => ({ ...milestone, amount: 0 }))");
  });
});
