import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { totalInOneCurrency } from "@/lib/money";
import { protectionFor } from "@/lib/protection";
import { dict } from "@/lib/i18n";

/**
 * The bugs the audit found, pinned so they cannot come back.
 *
 * Each of these produced a wrong answer with a confident face, which is the
 * category worth a test rather than a note.
 */
describe("money is never added across currencies", () => {
  it("totals only the dominant currency, and says how many were left out", () => {
    // A freelancer with one client in dollars and one in euros used to see a
    // number that was neither, labelled with whichever row came first.
    const out = totalInOneCurrency([
      { amount: 100, currency: "USD" },
      { amount: 200, currency: "USD" },
      { amount: 900, currency: "EUR" },
    ]);
    expect(out).toEqual({ total: 300, currency: "USD", otherCurrencies: 1 });
  });

  it("says nothing was left out when everything agrees", () => {
    const out = totalInOneCurrency([
      { amount: 100, currency: "USD" },
      { amount: 50, currency: "USD" },
    ]);
    expect(out).toEqual({ total: 150, currency: "USD", otherCurrencies: 0 });
  });

  it("picks the currency most rows are in, not the first one", () => {
    const out = totalInOneCurrency([
      { amount: 5, currency: "GBP" },
      { amount: 10, currency: "EUR" },
      { amount: 10, currency: "EUR" },
    ]);
    expect(out.currency).toBe("EUR");
    expect(out.total).toBe(20);
  });

  it("handles an empty list", () => {
    expect(totalInOneCurrency([])).toEqual({ total: 0, currency: null, otherCurrencies: 0 });
  });

  it("is what the home page uses", () => {
    const view = readFileSync("src/app/(app)/home/home-view.tsx", "utf8");
    expect(view).toContain("totalInOneCurrency(");
    // The old shape, which summed everything and labelled it with row zero.
    expect(view).not.toContain("data.invoices.reduce((sum, invoice) => sum + invoice.total, 0)");
  });
});

describe("the protection level only moves its own sections", () => {
  const review = readFileSync("src/components/quote/plan-review.tsx", "utf8");

  it("keeps hand-made choices when the level changes", () => {
    // It used to rebuild the list from the new level, throwing away anything
    // ticked or unticked by hand.
    expect(review).toContain("const before = protectionFor(protection).sections;");
    expect(review).toContain("!before.includes(key) || after.includes(key)");
  });

  it("lists every section that is on, whatever put it there", () => {
    // Sections added by the level were applied invisibly and could not be
    // unticked. A choice you cannot see is not a choice.
    expect(review).toContain("listedSections.map(");
    expect(review).not.toContain("{plan.sections.map((section) => {");
  });

  it("still has sections the level adds beyond the plan's", () => {
    // If this were empty the bug would be untestable rather than fixed.
    expect(protectionFor("GUARDED").sections.length).toBeGreaterThan(
      protectionFor("KNOWN").sections.length
    );
  });
});

describe("alerts are not derived from a page-sized slice", () => {
  const page = readFileSync("src/app/(app)/home/page.tsx", "utf8");

  it("reads every active project's stages, not the six the list shows", () => {
    // A seventh project's stage could sit unanswered past its window forever.
    expect(page).toContain("staged.flatMap(");
    expect(page).toContain("Every active project's stages, not just the six");
  });

  it("does not put a take on the stage query", () => {
    const staged = page.slice(page.indexOf("Every active project's stages"));
    const query = staged.slice(0, staged.indexOf("}),"));
    expect(query).not.toContain("take:");
  });
});

describe("the client is matched on the name you typed", () => {
  it("prefers it over whatever the model wrote", () => {
    const briefs = readFileSync("src/actions/briefs.ts", "utf8");
    expect(briefs).toContain("draftInput.clientName?.trim() || generated.client");
  });

  it("carries that name from the wizard", () => {
    const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");
    expect(wizard).toContain("clientName: clientName.trim() || undefined,");
  });
});

describe("stage billing agrees with the payment plan", () => {
  it("starts on when the saved plan already bills per milestone", () => {
    // Otherwise the quote said "these are the stages, payment follows the
    // terms below" while the terms said payment is per stage.
    const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");
    expect(wizard).toContain('defaultBillable={draft.paymentPlan === "MILESTONE"}');
  });
});

describe("the form has a hierarchy again", () => {
  const wizard = readFileSync("src/app/(app)/quote/quote-wizard.tsx", "utf8");

  it("splits what you are saying now from what Memory already knows", () => {
    /**
     * Two cards, and the distinction is provenance rather than topic. The
     * brief, the client, your instructions and any references are what you
     * are telling Freely about this job. The rate and the payment split are
     * what it already knows about how you work, brought forward so they can
     * be overridden for this one quote. Folded together, your standing
     * answers looked like questions being asked again.
     */
    expect(wizard).toContain("<DisclosureRow");
    expect(wizard).toContain("what you are telling Freely about this job");
    expect(wizard).toContain("what it already knows about how you work");
  });

  it("opens one row at a time across the whole form", () => {
    expect(wizard).toContain("onOpenRow={(row) => setOpenRow(row)}");
  });

  it("says when visual references are worth adding", () => {
    // It was a drop zone the size of the brief box, given to an optional extra.
    const en = readFileSync("src/lib/i18n/en.ts", "utf8");
    expect(en).toContain("referencesWhen:");
    expect(wizard).toContain("t.quote.referencesWhen");
  });
});


describe("the rest of the audit", () => {
  it("does not land a brand new account on an empty page", () => {
    // Sign-in goes to Home, which for somebody straight out of onboarding was
    // "nothing here yet" and one paragraph.
    const page = readFileSync("src/app/(app)/home/page.tsx", "utf8");
    expect(page).toContain('redirect("/quote")');
  });

  it("stops the button promising something it does not produce", () => {
    // It said "Generate the quote" and produced a plan.
    expect(dict("en").quote.generate).toBe("Read the brief");
    expect(dict("en").quote.planWrite).toBe("Write the quote");
  });

  it("bounds the first-time relink", () => {
    // It ran on the path of saving a quote and read the whole account.
    const db = readFileSync("src/lib/client-db.ts", "utf8");
    expect(db).toContain("const BACKFILL_WINDOW = 500;");
  });

  it("shows the protection level on the quote it shaped", () => {
    // Decided before a word was written, stored, and never shown, so a quote
    // with eight clauses and one with two looked like the same decision.
    const view = readFileSync("src/app/(app)/quote/[briefId]/brief-view.tsx", "utf8");
    expect(view).toContain("t.quote.protectionGuarded");
  });
});
