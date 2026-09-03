import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  GROUND_RULES,
  DEFAULT_RULE_SETTINGS,
  brokenRules,
  blockingRules,
  parseRuleSettings,
  ruleOf,
  type CheckableQuote,
} from "@/lib/ground-rules";
import { ruleWords } from "@/lib/rule-words";
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
    assumptions: ["12 pages", "copy supplied by you", "testing not included, quoted separately"],
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
    expect(brokenRules(quote, { off: [], maxUnpaidHours: 20 }).map((r) => r.key)).not.toContain(
      "unpaidStretch"
    );
    expect(brokenRules(quote, { off: [], maxUnpaidHours: 4 }).map((r) => r.key)).toContain(
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

describe("switching rules off", () => {
  it("stops checking one that is off", () => {
    const quote = { ...good, extras: { ...good.extras, assumptions: [] } };
    expect(brokenRules(quote, { off: ["assumptions"], maxUnpaidHours: 10 }).map((r) => r.key)).not.toContain(
      "assumptions"
    );
  });

  it("reads settings defensively", () => {
    expect(parseRuleSettings(null)).toEqual(DEFAULT_RULE_SETTINGS);
    expect(parseRuleSettings({ off: ["nonsense", "assumptions"] }).off).toEqual(["assumptions"]);
    expect(parseRuleSettings({ maxUnpaidHours: -4 }).maxUnpaidHours).toBe(10);
    expect(parseRuleSettings({ maxUnpaidHours: 5000 }).maxUnpaidHours).toBe(200);
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
