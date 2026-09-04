import { describe, it, expect } from "vitest";
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
