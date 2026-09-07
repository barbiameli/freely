import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { readHistory } from "@/lib/client-read";
import type { ClientHistory } from "@/lib/clients";

function history(over: Partial<ClientHistory> = {}): ClientHistory {
  return {
    quotes: 3,
    won: 2,
    lost: 1,
    typicalAnswerDays: 5,
    typicalPaymentDays: 0,
    overdueInvoices: 0,
    ...over,
  };
}

describe("what the history means", () => {
  it("says nothing it cannot check on a client with no past", () => {
    expect(readHistory(history({ quotes: 0 }))).toEqual(["new"]);
  });

  it("leads with money, because that is what goes wrong expensively", () => {
    const read = readHistory(history({ overdueInvoices: 1, typicalAnswerDays: 1 }));
    expect(read[0]).toBe("overdue");
  });

  it("prefers something overdue now to a pattern of paying late", () => {
    // Both are true; only one needs doing today.
    expect(readHistory(history({ overdueInvoices: 2, typicalPaymentDays: 9 }))).toContain(
      "overdue"
    );
    expect(readHistory(history({ overdueInvoices: 2, typicalPaymentDays: 9 }))).not.toContain(
      "slow"
    );
  });

  it("notices a client who pays on time", () => {
    expect(readHistory(history({ typicalPaymentDays: -2 }))).toContain("reliable");
  });

  it("notices several quotes and nothing won", () => {
    expect(readHistory(history({ quotes: 4, won: 0 }))).toContain("losing");
  });

  it("never says more than three things", () => {
    // A wall nobody reads, and the fourth is always the weakest.
    const busy = readHistory(
      history({ quotes: 5, won: 0, overdueInvoices: 2, typicalAnswerDays: 20 })
    );
    expect(busy.length).toBeLessThanOrEqual(3);
  });

  it("says nothing about a figure it does not have", () => {
    const unknown = readHistory(
      history({ typicalAnswerDays: null, typicalPaymentDays: null })
    );
    expect(unknown).not.toContain("slow");
    expect(unknown).not.toContain("quiet");
    expect(unknown).not.toContain("decisive");
  });
});

describe("the client page", () => {
  const page = readFileSync("src/app/(app)/clients/[clientId]/page.tsx", "utf8");
  const list = readFileSync("src/app/(app)/clients/page.tsx", "utf8");
  const sidebar = readFileSync("src/components/sidebar.tsx", "utf8");

  it("puts the figures above the inference", () => {
    // Somebody deciding whether to trust "ask for a deposit" needs to see the
    // "pays 6 days late" it came from.
    expect(page.indexOf("<StatRow")).toBeLessThan(page.indexOf("readHistory(history)"));
  });

  it("shows their quotes, projects and invoices", () => {
    expect(page).toContain("/track/${project.id}");
    expect(page).toContain("/quote/${quote.id}");
    expect(page).toContain("/invoices/${invoice.id}");
  });

  it("has a way in", () => {
    // The Client record existed for months with no page: the app knew how a
    // client paid and the only way to find out was to write them a quote.
    expect(sidebar).toContain('href: "/clients"');
    expect(list).toContain("clientsForUser");
  });
});
