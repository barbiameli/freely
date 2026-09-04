import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  applyChoices,
  conflictsFrom,
  incoherent,
  reconcile,
  type MoneyAsk,
  type MoneyState,
} from "@/lib/money-asks";
import { planSchema } from "@/lib/quote-plan";
import { dict } from "@/lib/i18n";

const mine: MoneyState = {
  rateUnit: "HOUR",
  billing: "FIXED_TOTAL",
  paymentPlan: "SPLIT",
  upfrontPercent: 50,
};

const asks = (over: Partial<MoneyAsk>[]): MoneyAsk[] =>
  over.map((o) => ({ topic: "rateUnit", value: "FIXED", quote: "", ...o }) as MoneyAsk);

/**
 * The brief wins, out loud.
 *
 * Five things decided how a quote's money worked and nothing compared them, so
 * a brief asking for a fixed price reached somebody whose setup said fifty an
 * hour and the quote came out saying one thing in the terms and another in the
 * figures. Nobody was told.
 */
describe("where the brief and the setup disagree", () => {
  it("finds a real disagreement", () => {
    const found = conflictsFrom(asks([{ topic: "rateUnit", value: "FIXED", quote: "a fixed fee" }]), mine);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ topic: "rateUnit", yours: "HOUR", theirs: "FIXED" });
  });

  it("says nothing when the brief asks for what you already do", () => {
    // Showing agreement as a choice trains people to click through the ones
    // that matter.
    expect(conflictsFrom(asks([{ topic: "rateUnit", value: "HOUR" }]), mine)).toEqual([]);
  });

  it("says nothing when the brief raises no money at all", () => {
    expect(conflictsFrom([], mine)).toEqual([]);
  });

  it("keeps one answer per question", () => {
    const found = conflictsFrom(
      asks([
        { topic: "rateUnit", value: "FIXED", quote: "first" },
        { topic: "rateUnit", value: "DAY", quote: "second" },
      ]),
      mine
    );
    expect(found).toHaveLength(1);
    expect(found[0].quote).toBe("first");
  });

  it("carries the client's own words, for showing", () => {
    const found = conflictsFrom(
      asks([{ topic: "paymentPlan", value: "UPFRONT", quote: "we pay in advance" }]),
      mine
    );
    expect(found[0].quote).toBe("we pay in advance");
  });
});

describe("applying the answers", () => {
  const conflicts = conflictsFrom(
    asks([
      { topic: "rateUnit", value: "FIXED" },
      { topic: "paymentPlan", value: "UPFRONT" },
    ]),
    mine
  );

  it("takes only the ones the freelancer chose to follow", () => {
    const out = applyChoices(mine, conflicts, ["rateUnit"]);
    expect(out.rateUnit).toBe("FIXED");
    expect(out.paymentPlan).toBe("SPLIT");
  });

  it("changes nothing when they kept all of their own", () => {
    expect(applyChoices(mine, conflicts, [])).toEqual(mine);
  });

  it("reads a deposit percentage, and keeps it sane", () => {
    const deposit = conflictsFrom(asks([{ topic: "deposit", value: "30" }]), mine);
    expect(applyChoices(mine, deposit, ["deposit"]).upfrontPercent).toBe(30);

    const silly = conflictsFrom(asks([{ topic: "deposit", value: "900" }]), mine);
    expect(applyChoices(mine, silly, ["deposit"]).upfrontPercent).toBe(100);
  });
});

describe("a quote arguing with itself", () => {
  it("spots a fixed price that is also billed by the hour", () => {
    const wrong = { ...mine, rateUnit: "FIXED", billing: "HOURLY_TRACKED" };
    expect(incoherent(wrong, { hasMilestones: false, milestonesBillable: false })).toContain(
      "billing"
    );
  });

  it("spots stages with no amounts on a quote billed per stage", () => {
    const wrong = { ...mine, paymentPlan: "MILESTONE" };
    expect(incoherent(wrong, { hasMilestones: true, milestonesBillable: false })).toContain(
      "paymentPlan"
    );
  });

  it("is quiet about a coherent quote", () => {
    expect(incoherent(mine, { hasMilestones: false, milestonesBillable: false })).toEqual([]);
  });

  it("corrects the leftover rather than asking about it", () => {
    // The rate unit was chosen deliberately; the basis is the thing left
    // behind when it changed.
    const fixed = reconcile(
      { ...mine, rateUnit: "FIXED", billing: "HOURLY_TRACKED" },
      { hasMilestones: false, milestonesBillable: false }
    );
    expect(fixed.billing).toBe("FIXED_TOTAL");
  });
});

describe("what the reading step is told to look for", () => {
  const source = readFileSync("src/lib/quote-plan.ts", "utf8");

  it("only reports what the brief says outright", () => {
    expect(source).toContain("EXPLICITLY says about how the money works");
    expect(source).toContain("nothing it merely implies");
  });

  it("does not treat a budget as a request for a fixed price", () => {
    // The commonest bad inference, and the most expensive.
    expect(source).toContain(
      "A client saying what they can spend is not a client asking for a fixed price"
    );
  });

  it("comes back empty by default", () => {
    expect(planSchema.parse({}).moneyAsks).toEqual([]);
  });

  it("drops a topic it does not know rather than losing the plan", () => {
    /**
     * A strict enum meant the model inventing one topic lost the entire
     * reading: the paragraph, the stages, the questions, all of it, and the
     * freelancer was told the brief could not be understood. One unusable
     * line is not a reason to throw away nine good ones.
     */
    const parsed = planSchema.safeParse({
      reading: "A real reading.",
      moneyAsks: [
        { topic: "vibes", value: "x" },
        { topic: "rateUnit", value: "FIXED", quote: "a fixed fee" },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.reading).toBe("A real reading.");
    expect(parsed.data.moneyAsks).toHaveLength(1);
    expect(parsed.data.moneyAsks[0].topic).toBe("rateUnit");
  });
});

describe("one phase or stages", () => {
  const review = readFileSync("src/components/quote/plan-review.tsx", "utf8");
  const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");

  it("is always asked, whatever the brief or the account says", () => {
    // It is a question about how this job runs rather than a preference, and
    // the same freelancer does both.
    expect(review).toContain("t.quote.planPhases");
    expect(review).toContain("setPhased(false)");
    expect(review).toContain("setPhased(true)");
  });

  it("only asks about money once stages are chosen", () => {
    expect(review).toContain("{phased && (");
    expect(review).toContain("t.quote.planStagesFor");
  });

  it("does not turn stages into milestone billing on its own", () => {
    expect(wizard).toContain("choices.phased && choices.milestonesBillable");
  });

  it("does not send a stage list for a one-phase quote", () => {
    expect(wizard).toContain('choices.phased ? milestonesForPrompt(plan, choices.milestones) : ""');
  });
});


describe("nothing overrides silently", () => {
  const review = readFileSync("src/components/quote/plan-review.tsx", "utf8");

  it("says when the protection level beats the payment answer", () => {
    /**
     * The last silent override in the flow. Somebody could choose "paid in
     * full up front" two cards down and get a milestone schedule without ever
     * being told which answer won.
     */
    expect(review).toContain("overridesPayment");
    expect(review).toContain("t.quote.protectionChangesPayment");
  });

  it("says which way, from and to", () => {
    expect(dict("en").quote.protectionChangesPayment).toContain("{from}");
    expect(dict("en").quote.protectionChangesPayment).toContain("{to}");
  });

  it("says why, not just what", () => {
    // "This changes your payment" on its own reads as the app being difficult.
    expect(dict("en").quote.protectionChangesWhy).toContain(
      "one stage of work rather than the whole project"
    );
  });

  it("stays quiet when it changes nothing", () => {
    expect(review).toContain("chosen.paymentPlan !== money.paymentPlan");
  });
});
