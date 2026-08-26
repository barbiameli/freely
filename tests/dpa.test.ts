import { describe, it, expect } from "vitest";
import { CLAUSES, SUBPROCESSORS, needsReview } from "@/lib/dpa";

/**
 * What a processor contract has to contain.
 *
 * Article 28(3) lists the terms a contract between a controller and a
 * processor must include. Missing one does not make the document weaker in
 * some vague way, it makes it non-compliant, and the failure is silent: the
 * page renders perfectly and answers a question it is not entitled to answer.
 *
 * So the mandatory subjects are checked by keyword. Crude, and the right kind
 * of crude: it cannot tell whether a clause is well drafted, but it can tell
 * whether somebody tidying this file has deleted the only paragraph covering
 * breach notification.
 */
const REQUIRED = [
  { subject: "documented instructions", match: /documented instructions/i },
  { subject: "confidentiality", match: /duty of confidence|confidential/i },
  { subject: "security measures (Art 32)", match: /Article 32/i },
  { subject: "sub-processors", match: /sub-processor/i },
  { subject: "data subject rights", match: /corrected|deleted|asks for it/i },
  { subject: "breach notification", match: /personal data breach/i },
  { subject: "deletion or return", match: /deletes all personal data|returned/i },
  { subject: "audits", match: /audit/i },
  { subject: "international transfers", match: /standard contractual clauses/i },
];

const ALL_TEXT = CLAUSES.flatMap((c) => [c.title, ...c.body]).join("\n");

describe("the agreement covers what Article 28 requires", () => {
  for (const { subject, match } of REQUIRED) {
    it(`says something about ${subject}`, () => {
      expect(match.test(ALL_TEXT), subject).toBe(true);
    });
  }
});

describe("the document holds together", () => {
  it("numbers its clauses in order, with no gaps", () => {
    expect(CLAUSES.map((c) => c.number)).toEqual(
      CLAUSES.map((_, i) => String(i + 1))
    );
  });

  it("gives every clause something to say", () => {
    for (const clause of CLAUSES) {
      expect(clause.body.length, clause.number).toBeGreaterThan(0);
      for (const paragraph of clause.body) {
        expect(paragraph.trim().length, clause.number).toBeGreaterThan(40);
      }
    }
  });

  // Publishing something that reads binding while quietly containing
  // unreviewed clauses is worse than publishing nothing, so the page counts
  // them and says so at the top. If this ever reaches zero, the banner
  // disappears, which should be a deliberate act rather than a surprise.
  it("knows which clauses are still awaiting review", () => {
    const flagged = needsReview().map((c) => c.number);
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged).toEqual(["10", "11", "12"]);
  });
});

describe("the sub-processor list", () => {
  it("names every company that touches customer data", () => {
    expect(SUBPROCESSORS.map((s) => s.name).sort()).toEqual([
      "Anthropic",
      "Neon",
      "Resend",
      "Vercel",
    ]);
  });

  // A list that says who without saying why or where is a list that answers
  // nothing, and the link is what lets somebody check rather than trust.
  it("says what each one is for, where it is, and links its terms", () => {
    for (const sub of SUBPROCESSORS) {
      expect(sub.purpose.length, sub.name).toBeGreaterThan(20);
      expect(sub.location.length, sub.name).toBeGreaterThan(3);
      expect(sub.terms, sub.name).toMatch(/^https:\/\//);
    }
  });

  it("has no duplicates", () => {
    const names = SUBPROCESSORS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
