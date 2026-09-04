import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  clientSlug,
  historyFrom,
  isRealName,
  levelFromHistory,
  NO_HISTORY,
} from "@/lib/clients";

const NOW = Date.parse("2026-09-03T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000);

/**
 * Who the work is for.
 *
 * Freely had no such thing: a client was a free-text string on a quote, a
 * different one on a project and a third on an invoice, so it could not answer
 * the question a freelancer asks first about any job. These tests are mostly
 * about matching being conservative, because a duplicate is visible and a bad
 * merge is not.
 */
describe("matching a name", () => {
  it("treats spelling and case as the same client", () => {
    expect(clientSlug("Beyond Data")).toBe(clientSlug("beyond  data"));
    expect(clientSlug("Beyond Data Ltd.")).toBe(clientSlug("Beyond Data"));
    expect(clientSlug("Beyond Data, Inc")).toBe(clientSlug("Beyond Data"));
  });

  it("ignores accents", () => {
    expect(clientSlug("Sánchez Studio")).toBe(clientSlug("Sanchez Studio"));
  });

  it("keeps two different clients apart", () => {
    // Fuzzy matching would eventually merge these, and a bad merge is a
    // mistake nobody can see.
    expect(clientSlug("Beyond Data")).not.toBe(clientSlug("Beyond Design"));
    expect(clientSlug("Ergo")).not.toBe(clientSlug("Ergon"));
  });

  it("does not strip a name that is only a suffix", () => {
    expect(clientSlug("Studio")).toBe("studio");
  });

  it("refuses the stand-ins a brief with no client produces", () => {
    // Otherwise every anonymous quote collects under one imaginary client.
    expect(isRealName("Client")).toBe(false);
    expect(isRealName("the client")).toBe(false);
    expect(isRealName("Cliente")).toBe(false);
    expect(isRealName("")).toBe(false);
    expect(isRealName("Beyond Data")).toBe(true);
  });
});

describe("what has happened with them", () => {
  it("counts nothing as nothing", () => {
    expect(historyFrom([], [])).toEqual(NO_HISTORY);
  });

  it("reads the answer time from quotes that were answered", () => {
    const history = historyFrom(
      [
        { outcome: "WON", createdAt: daysAgo(40), acceptedAt: daysAgo(35) },
        { outcome: "WON", createdAt: daysAgo(20), acceptedAt: daysAgo(17) },
        { outcome: "PENDING", createdAt: daysAgo(3), acceptedAt: null },
      ],
      [],
      NOW
    );
    expect(history.quotes).toBe(3);
    expect(history.won).toBe(2);
    expect(history.typicalAnswerDays).toBe(4);
  });

  it("reads how late they pay, and counts what is still owed", () => {
    const history = historyFrom(
      [],
      [
        { dueAt: daysAgo(40), paidAt: daysAgo(20) },
        { dueAt: daysAgo(30), paidAt: daysAgo(12) },
        { dueAt: daysAgo(5), paidAt: null },
      ],
      NOW
    );
    expect(history.typicalPaymentDays).toBe(19);
    expect(history.overdueInvoices).toBe(1);
  });

  it("counts paying early as early", () => {
    const history = historyFrom([], [{ dueAt: daysAgo(10), paidAt: daysAgo(14) }], NOW);
    expect(history.typicalPaymentDays).toBe(-4);
  });
});

describe("what the history says about protection", () => {
  it("calls a stranger new", () => {
    expect(levelFromHistory(NO_HISTORY)).toEqual({ level: "NEW", reason: "new" });
  });

  it("lightens up for somebody who paid on time", () => {
    const level = levelFromHistory({
      ...NO_HISTORY,
      quotes: 3,
      won: 3,
      typicalPaymentDays: 2,
    });
    expect(level).toEqual({ level: "KNOWN", reason: "good" });
  });

  it("guards against somebody already holding an overdue invoice", () => {
    const level = levelFromHistory({ ...NO_HISTORY, quotes: 2, won: 2, overdueInvoices: 1 });
    expect(level?.level).toBe("GUARDED");
    expect(level?.reason).toBe("overdue");
  });

  it("guards against a habit of paying well after the terms", () => {
    const level = levelFromHistory({
      ...NO_HISTORY,
      quotes: 4,
      won: 4,
      typicalPaymentDays: 30,
    });
    expect(level).toEqual({ level: "GUARDED", reason: "paidLate" });
  });

  it("does not call somebody known who has never actually hired you", () => {
    const level = levelFromHistory({ ...NO_HISTORY, quotes: 3, lost: 3 });
    expect(level).toEqual({ level: "NEW", reason: "unproven" });
  });
});

describe("how the app uses it", () => {
  const db = readFileSync("src/lib/client-db.ts", "utf8");
  const briefs = readFileSync("src/actions/briefs.ts", "utf8");
  const invoices = readFileSync("src/actions/invoices.ts", "utf8");
  const plan = readFileSync("src/actions/plan.ts", "utf8");

  it("creates the record as a side effect of work already being done", () => {
    // A client list maintained by hand is admin, and admin gets abandoned.
    // And on the name they typed, not the one the model wrote: those differ
    // often enough to make duplicate clients.
    expect(briefs).toContain(
      "clientFor(user.id, draftInput.clientName?.trim() || generated.client)"
    );
    expect(invoices).toContain("clientFor(user.id, seed.clientName)");
  });

  it("joins up what was already in the database", () => {
    // Otherwise the history starts empty for everybody who has been using it.
    expect(db).toContain("async function backfill");
  });

  it("never lets a lookup stop somebody quoting or invoicing", () => {
    expect(briefs).toContain("could not resolve client");
    expect(invoices).toContain("could not resolve client");
  });

  it("reads the whole studio's history, not one person's", () => {
    // Every other read in the app goes through teamScopeWhere. This did not,
    // so two people quoting the same client built separate histories.
    expect(db).toContain("teamScopeWhere(user)");
  });

  it("lets the history override what the brief implied", () => {
    expect(plan).toContain("levelFromHistory(history)");
  });

  it("takes the invoice due date from the account's own rule", () => {
    expect(invoices).toContain('valueOf(');
    expect(invoices).not.toContain("dueAt.getDate() + 30");
  });
});
