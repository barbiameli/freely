import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  GROUND_RULES,
  DEFAULT_RULE_SETTINGS,
  brokenRules,
  blockingRules,
  parseRuleSettings,
  ruleValues,
  ruleOf,
  type CheckableQuote,
} from "@/lib/ground-rules";
import { ruleWords, ruleFix } from "@/lib/rule-words";
import { dict } from "@/lib/i18n";

/** A quote that satisfies everything, so each test can break one thing. */
const good: CheckableQuote = {
  hours: 8,
  price: 400,
  rateUnit: "HOUR",
  billing: "FIXED_TOTAL",
  milestoneCount: 2,
  extras: {
    paymentTerms:
      "50% up front and the rest on delivery, due within 7 business days. Anything delivered and not commented on within 10 business days is treated as accepted.",
    revisions: "Two rounds of changes are included per milestone.",
    assumptions: [
      "12 pages",
      "copy supplied by you",
      "testing not included, quoted separately",
      "2 calls included, a kickoff and one review",
    ],
    scopeChanges: ["more pages than the 12 above", "a second reviewer joining partway through"],
    terms: {
      cancellation: "Work completed is invoiced, and the part in progress is invoiced in full.",
      ownership: "Rights transfer on final payment.",
      confidentiality: "Nothing you share goes anywhere else.",
    },
  },
};

describe("the starter set", () => {
  it("passes a quote that says everything", () => {
    expect(brokenRules(good, DEFAULT_RULE_SETTINGS)).toEqual([]);
  });

  it("has words for every rule, in both languages", () => {
    for (const locale of ["en", "es"] as const) {
      for (const rule of GROUND_RULES) {
        const words = ruleWords(rule.key, dict(locale));
        expect(words.title.length, `${rule.key} ${locale} title`).toBeGreaterThan(0);
        expect(words.why.length, `${rule.key} ${locale} why`).toBeGreaterThan(0);
        expect(words.cost.length, `${rule.key} ${locale} cost`).toBeGreaterThan(0);
      }
    }
  });

  it("states a number wherever a rule needs one", () => {
    // A rule with no figure in it cannot be put on a quote, which leaves the
    // actual term to be invented per project.
    const values = ruleValues(DEFAULT_RULE_SETTINGS);
    expect(values).toEqual({
      paymentDays: 14,
      depositPercent: 50,
      revisionRounds: 2,
      feedbackDays: 3,
      acceptanceDays: 10,
      callsIncluded: 2,
      maxUnpaidHours: 10,
    });
  });

  it("says every rule as a sentence with its figures marked", () => {
    for (const rule of GROUND_RULES) {
      const statement = ruleWords(rule.key, dict("en")).statement;
      expect(statement.length, rule.key).toBeGreaterThan(0);
      for (const spec of [rule.value, rule.extra]) {
        if (!spec) continue;
        expect(statement, `${rule.key} states ${spec.key}`).toContain(`{${spec.key}}`);
      }
    }
  });

  it("knows how to repair what it complains about", () => {
    // A flag that only names a gap leaves the freelancer writing the clause,
    // which is the work they opened Freely to avoid.
    const values = ruleValues(DEFAULT_RULE_SETTINGS);
    for (const rule of GROUND_RULES) {
      const fix = ruleFix(rule.key, values);
      if (!rule.checkable) {
        expect(fix, rule.key).toBe("");
      } else {
        expect(fix.length, rule.key).toBeGreaterThan(20);
      }
    }
    expect(ruleFix("revisionRounds", values)).toContain("2 rounds");
    expect(ruleFix("paymentBasis", values)).toContain("14 days");
    expect(ruleFix("paymentBasis", values)).toContain("50%");
  });

  it("carries the account's own figures into the fix", () => {
    const values = ruleValues({ off: [], values: { revisionRounds: 1, paymentDays: 7 } });
    expect(ruleFix("revisionRounds", values)).toContain("1 rounds");
    expect(ruleFix("paymentBasis", values)).toContain("7 days");
  });

  it("keeps exactly three rules able to block publishing", () => {
    // Deliberately few. A gate people meet on every quote is a gate they
    // learn to click through without reading.
    const blocking = GROUND_RULES.filter((r) => r.severity === "blocking").map((r) => r.key);
    expect(blocking).toEqual(["paymentBasis", "revisionRounds", "assumptions"]);
  });

  it("never flags a rule that cannot be read off a quote", () => {
    const empty: CheckableQuote = { hours: 0, price: 0, milestoneCount: 0, extras: null };
    const flagged = brokenRules(empty, DEFAULT_RULE_SETTINGS).map((r) => r.key);
    expect(flagged).not.toContain("beforeSignature");
    expect(flagged).not.toContain("noNumberBeforeScope");
  });
});

describe("what each rule catches", () => {
  it("no payment terms", () => {
    const quote = { ...good, extras: { ...good.extras, paymentTerms: undefined } };
    expect(brokenRules(quote, DEFAULT_RULE_SETTINGS).map((r) => r.key)).toContain("paymentBasis");
  });

  it("a revisions policy with no number", () => {
    const quote = {
      ...good,
      extras: { ...good.extras, revisions: "Revisions are included within reason." },
    };
    expect(brokenRules(quote, DEFAULT_RULE_SETTINGS).map((r) => r.key)).toContain("revisionRounds");
  });

  it("accepts a number spelled out", () => {
    const quote = { ...good, extras: { ...good.extras, revisions: "Two rounds included." } };
    expect(brokenRules(quote, DEFAULT_RULE_SETTINGS).map((r) => r.key)).not.toContain(
      "revisionRounds"
    );
  });

  it("leaves a quote with no revisions section alone", () => {
    // Plenty of work does not attract rounds of changes, and inventing a
    // policy for it would be worse than saying nothing.
    const quote = { ...good, extras: { ...good.extras, revisions: undefined } };
    expect(brokenRules(quote, DEFAULT_RULE_SETTINGS).map((r) => r.key)).not.toContain(
      "revisionRounds"
    );
  });

  it("no assumptions", () => {
    const quote = { ...good, extras: { ...good.extras, assumptions: [] } };
    expect(brokenRules(quote, DEFAULT_RULE_SETTINGS).map((r) => r.key)).toContain("assumptions");
  });

  it("a long job with one payment at the end", () => {
    const quote = {
      ...good,
      hours: 40,
      milestoneCount: 0,
      extras: { ...good.extras, paymentTerms: "Invoiced on delivery, due within 7 days." },
    };
    expect(brokenRules(quote, DEFAULT_RULE_SETTINGS).map((r) => r.key)).toContain("unpaidStretch");
  });

  it("counts a deposit as breaking the unpaid stretch", () => {
    const quote = { ...good, hours: 40, milestoneCount: 0 };
    expect(brokenRules(quote, DEFAULT_RULE_SETTINGS).map((r) => r.key)).not.toContain(
      "unpaidStretch"
    );
  });

  it("respects the account's own number", () => {
    const quote = {
      ...good,
      hours: 12,
      milestoneCount: 0,
      extras: { ...good.extras, paymentTerms: "Invoiced on delivery within 7 business days. Treated as accepted after 10 business days." },
    };
    expect(brokenRules(quote, { off: [], values: { maxUnpaidHours: 20 } }).map((r) => r.key)).not.toContain(
      "unpaidStretch"
    );
    expect(brokenRules(quote, { off: [], values: { maxUnpaidHours: 4 } }).map((r) => r.key)).toContain(
      "unpaidStretch"
    );
  });

  it("treats a removed section as absent", () => {
    // A section the freelancer took off the quote never reaches the client,
    // so a rule that reads it would be checking a document nobody gets.
    const quote = { ...good, hidden: ["assumptions"] };
    expect(brokenRules(quote, DEFAULT_RULE_SETTINGS).map((r) => r.key)).toContain("assumptions");
  });
});

describe("a choice that has been made", () => {
  /**
   * Paid in full before the work starts.
   *
   * The freelancer said so in the brief and it is their saved preference, and
   * Freely still told them to add a deemed-acceptance clause and warned about
   * unpaid work. Both exist to protect somebody who has not been paid. A rule
   * that fires anyway is not being careful, it is overruling a decision it was
   * told about.
   */
  const upFront: CheckableQuote = {
    ...good,
    hours: 60,
    milestoneCount: 0,
    paymentPlan: "UPFRONT",
    extras: { ...good.extras, paymentTerms: "The full amount is due before the work starts." },
  };

  it("does not ask about approvals nobody is waiting on", () => {
    expect(brokenRules(upFront, DEFAULT_RULE_SETTINGS).map((r) => r.key)).not.toContain(
      "deemedAcceptance"
    );
  });

  it("does not warn about unpaid work to somebody already paid", () => {
    expect(brokenRules(upFront, DEFAULT_RULE_SETTINGS).map((r) => r.key)).not.toContain(
      "unpaidStretch"
    );
  });

  it("still raises the rules that do apply", () => {
    const bare: CheckableQuote = { ...upFront, extras: { paymentTerms: "Paid up front." } };
    expect(brokenRules(bare, DEFAULT_RULE_SETTINGS).map((r) => r.key)).toContain("assumptions");
  });

  it("keeps asking everyone else", () => {
    const onDelivery: CheckableQuote = { ...upFront, paymentPlan: "ON_DELIVERY" };
    const keys = brokenRules(onDelivery, DEFAULT_RULE_SETTINGS).map((r) => r.key);
    expect(keys).toContain("deemedAcceptance");
    expect(keys).toContain("unpaidStretch");
  });
});

describe("settling them", () => {
  const actions = readFileSync("src/actions/briefs.ts", "utf8");
  const modal = readFileSync("src/components/quote/before-you-send.tsx", "utf8");

  it("takes all of them in one pass", () => {
    // Five flags used to be five full rewrites of the quote, run one after
    // another, each re-reading what the last had just written.
    expect(actions).toContain("rules: string | string[]");
    expect(actions).toContain("Make all of the following changes in one pass");
    expect(modal).toContain("flagFixAll");
  });

  it("says which ones it actually applied", () => {
    expect(actions).toContain("applied");
  });

  it("drops a flag as soon as it is settled", () => {
    // The flags are computed from the quote as the page last loaded it, so a
    // clause just added is not in that copy yet.
    expect(modal).toContain("setSettled");
    expect(modal).toContain("!settled.includes(rule.key)");
  });

  it("takes the server's copy back after a rewrite", () => {
    const view = readFileSync("src/app/(app)/quote/[briefId]/brief-view.tsx", "utf8");
    expect(view).toContain("}, [brief.updatedAt]);");
  });
});

describe("where the rules live", () => {
  it("is a tab inside Memory rather than a page of its own", () => {
    // The same kind of thing as the quote setup beside it: standing decisions
    // that shape every quote. Two pages was an accident of when each arrived.
    const memory = readFileSync("src/app/(app)/memory/memory-view.tsx", "utf8");
    expect(memory).toContain('{tab === "rules" && <RulesView settings={rules} />}');

    const sidebar = readFileSync("src/components/sidebar.tsx", "utf8");
    expect(sidebar).not.toContain('href: "/rules"');
  });

  it("keeps the old address working", () => {
    const page = readFileSync("src/app/(app)/rules/page.tsx", "utf8");
    expect(page).toContain('redirect("/memory?tab=rules")');
  });

  it("points every flag at the tab", () => {
    const modal = readFileSync("src/components/quote/before-you-send.tsx", "utf8");
    expect(modal).toContain('href="/memory?tab=rules"');
  });
});

describe("switching rules off", () => {
  it("stops checking one that is off", () => {
    const quote = { ...good, extras: { ...good.extras, assumptions: [] } };
    expect(brokenRules(quote, { off: ["assumptions"], values: {} }).map((r) => r.key)).not.toContain(
      "assumptions"
    );
  });

  it("reads settings defensively", () => {
    expect(parseRuleSettings(null)).toEqual(DEFAULT_RULE_SETTINGS);
    expect(parseRuleSettings({ off: ["nonsense", "assumptions"] }).off).toEqual(["assumptions"]);
    expect(parseRuleSettings({ values: { maxUnpaidHours: -4 } }).values.maxUnpaidHours).toBe(1);
    expect(parseRuleSettings({ values: { maxUnpaidHours: 5000 } }).values.maxUnpaidHours).toBe(200);
    // The shape this had before the figures existed still reads.
    expect(parseRuleSettings({ maxUnpaidHours: 25 }).values.maxUnpaidHours).toBe(25);
  });

  it("knows a real rule from an invented one", () => {
    expect(ruleOf("assumptions")).toBeTruthy();
    expect(ruleOf("be-nice")).toBeUndefined();
  });
});

describe("publishing", () => {
  it("waits on the blocking ones only", () => {
    const quote: CheckableQuote = {
      hours: 4,
      price: 200,
      milestoneCount: 1,
      extras: { paymentTerms: undefined },
    };
    const broken = brokenRules(quote, DEFAULT_RULE_SETTINGS);
    expect(broken.length).toBeGreaterThan(3);
    expect(blockingRules(broken).map((r) => r.key)).toEqual([
      "paymentBasis",
      "assumptions",
    ]);
  });

  it("offers the fix rather than only the complaint", () => {
    const actions = readFileSync("src/actions/briefs.ts", "utf8");
    expect(actions).toContain("applyRuleAction");
    // Reuses the refine everything else uses, so the clause arrives in the
    // quote's own voice and language.
    expect(actions).toContain("const result = await refineBriefAction(briefId, instruction);");
  });

  it("is checked on the server, not only in the page", () => {
    const actions = readFileSync("src/actions/briefs.ts", "utf8");
    expect(actions).toContain("blockingRules(");
    expect(actions).toContain("rulesAcknowledged");
  });

  it("shapes the quote as well as judging it", () => {
    // A flag that could have been avoided by telling the model up front is a
    // flag that should not have existed.
    const prompt = readFileSync("src/lib/anthropic.ts", "utf8");
    expect(prompt).toContain("This freelancer keeps these rules on their quotes");
    expect(prompt).toContain("do not mention the rules themselves");
  });

  it("can always be waved through", () => {
    // A rule that cannot be overridden is a rule people route around.
    const actions = readFileSync("src/actions/briefs.ts", "utf8");
    expect(actions).toContain("acknowledgeRuleAction");
  });
});
