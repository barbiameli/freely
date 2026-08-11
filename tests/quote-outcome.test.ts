import { describe, it, expect } from "vitest";
import {
  quotesToAskAbout,
  winRate,
  showWinRate,
  ASK_AFTER_DAYS,
  STOP_ASKING_AFTER_DAYS,
  type QuoteForPrompt,
} from "@/lib/quote-outcome";

const NOW = new Date("2026-06-01T12:00:00Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

function quote(over: Partial<QuoteForPrompt> = {}): QuoteForPrompt {
  return {
    id: "q1",
    title: "Brand refresh",
    client: "Aurora",
    price: 2400,
    currency: "GBP",
    createdAt: daysAgo(7),
    outcome: "PENDING",
    acceptedAt: null,
    tracked: false,
    ...over,
  };
}

describe("quotesToAskAbout", () => {
  it("asks about a quote old enough to have an answer", () => {
    expect(quotesToAskAbout([quote()], NOW)).toHaveLength(1);
  });

  it("says nothing about a quote sent this morning", () => {
    // Asking the same day is asking someone to predict the future, and it
    // teaches them to close the prompt.
    expect(quotesToAskAbout([quote({ createdAt: daysAgo(0.5) })], NOW)).toEqual([]);
    expect(quotesToAskAbout([quote({ createdAt: daysAgo(ASK_AFTER_DAYS - 0.1) })], NOW)).toEqual([]);
  });

  it("gives up on a quote nobody is going to remember", () => {
    expect(
      quotesToAskAbout([quote({ createdAt: daysAgo(STOP_ASKING_AFTER_DAYS + 1) })], NOW)
    ).toEqual([]);
  });

  it("leaves answered quotes alone", () => {
    expect(quotesToAskAbout([quote({ outcome: "WON" })], NOW)).toEqual([]);
    expect(quotesToAskAbout([quote({ outcome: "LOST" })], NOW)).toEqual([]);
  });

  it("does not ask about a quote the client already signed", () => {
    // A signature is an answer. Asking anyway reads as the app not paying
    // attention to something it was told directly.
    expect(quotesToAskAbout([quote({ acceptedAt: daysAgo(1) })], NOW)).toEqual([]);
  });

  it("hides what was in the prompt when it was closed", () => {
    const dismissed = daysAgo(3);
    const older = quote({ id: "old", createdAt: daysAgo(5) });
    expect(quotesToAskAbout([older], NOW, dismissed)).toEqual([]);
  });

  it("comes back for a quote written after it was closed", () => {
    // Closing means "not these", not "never again". A boolean here would
    // switch the feature off for good on the first dismissal.
    const dismissed = daysAgo(5);
    const newer = quote({ id: "new", createdAt: daysAgo(3) });
    expect(quotesToAskAbout([newer], NOW, dismissed).map((q) => q.id)).toEqual(["new"]);
  });

  it("puts the most recent first", () => {
    const out = quotesToAskAbout(
      [
        quote({ id: "older", createdAt: daysAgo(20) }),
        quote({ id: "newest", createdAt: daysAgo(3) }),
        quote({ id: "middle", createdAt: daysAgo(10) }),
      ],
      NOW
    );
    expect(out.map((q) => q.id)).toEqual(["newest", "middle", "older"]);
  });
});

describe("winRate", () => {
  it("counts only what has actually been decided", () => {
    // Counting pending quotes as losses would make someone who quotes a lot
    // look worse than someone who quotes rarely.
    const rate = winRate([
      { outcome: "WON" },
      { outcome: "WON" },
      { outcome: "LOST" },
      { outcome: "PENDING" },
      { outcome: "PENDING" },
    ]);
    expect(rate).toEqual({ won: 2, lost: 1, rate: 2 / 3 });
  });

  it("has no rate at all before anything is decided", () => {
    expect(winRate([{ outcome: "PENDING" }]).rate).toBeNull();
    expect(winRate([]).rate).toBeNull();
  });
});

describe("showWinRate", () => {
  it("stays quiet until the number means something", () => {
    // One win from one quote is 100%, and says nothing.
    expect(showWinRate({ won: 1, lost: 0, rate: 1 })).toBe(false);
    expect(showWinRate({ won: 2, lost: 1, rate: 2 / 3 })).toBe(false);
  });

  it("shows once there is enough behind it", () => {
    expect(showWinRate({ won: 3, lost: 1, rate: 0.75 })).toBe(true);
  });
});
