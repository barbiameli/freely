import { describe, it, expect } from "vitest";
import { CLAUSES, SUBPROCESSORS, PRIVACY_CONTACT } from "@/lib/dpa";

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
    expect(CLAUSES.map((clause) => clause.number)).toEqual(
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

  /**
   * The document used to carry three clauses marked as awaiting a lawyer, and
   * a banner counting them. They are written now, so nothing may reintroduce
   * the marker quietly: a clause that is not finished should not be published
   * at all rather than published with a label on it.
   */
  it("marks nothing as pending", () => {
    expect(ALL_TEXT).not.toMatch(/awaiting review|to be reviewed|placeholder|TBD|TODO/i);
  });

  it("says which law governs and which courts hear it", () => {
    expect(ALL_TEXT).toMatch(/governed by the law/i);
    expect(ALL_TEXT).toMatch(/jurisdiction/i);
  });

  it("gives an address for data protection questions", () => {
    expect(PRIVACY_CONTACT).toMatch(/@/);
    expect(ALL_TEXT).toContain(PRIVACY_CONTACT);
  });

  it("puts a number on the breach notice and the sub-processor notice", () => {
    expect(ALL_TEXT).toMatch(/within 48 hours/i);
    expect(ALL_TEXT).toMatch(/14 days' notice/i);
  });

  /**
   * Freely has never charged anybody. Saying so is honest, and saying only so
   * would be misleading: Article 28 does not care whether a processor is paid.
   */
  it("says the service is free without pretending that reduces anything", () => {
    expect(ALL_TEXT).toMatch(/free of charge/i);
    expect(ALL_TEXT).toMatch(/do not depend on being paid/i);
    expect(ALL_TEXT).toMatch(/does not make Freely a charity/i);
  });

  it("says what happens if it starts charging, and if it stops", () => {
    expect(ALL_TEXT).toMatch(/if Freely does start charging/i);
    expect(ALL_TEXT).toMatch(/30 days' notice by email and the means to export/i);
  });

  it("does not cap liability at a multiple of nothing", () => {
    // A cap expressed as fees paid comes to zero on a free service, which is a
    // disclaimer wearing a limitation's clothes.
    expect(ALL_TEXT).toMatch(/would come to nothing/i);
    expect(ALL_TEXT).toMatch(/limited to what the law allows/i);
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
