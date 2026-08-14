import { describe, it, expect } from "vitest";
import { maySend, grant, withdraw, newUnsubscribeToken } from "@/lib/marketing";
import { isTransactional } from "@/lib/email-kinds";

const OPTED_IN = { marketingOptIn: true, marketingOptInAt: new Date("2026-01-01") };
const OPTED_OUT = { marketingOptIn: false, marketingOptInAt: null };

describe("maySend", () => {
  it("lets a password reset through to somebody who opted out of everything", () => {
    // Unsubscribing from product news is not asking to stop being told your
    // password changed.
    expect(maySend("PASSWORD_RESET", OPTED_OUT)).toBe(true);
    expect(maySend("QUOTE_ACCEPTED", OPTED_OUT)).toBe(true);
    expect(maySend("NUDGE_OVERDUE", OPTED_OUT)).toBe(true);
  });

  it("refuses marketing to somebody who never said yes", () => {
    expect(maySend("MARKETING", OPTED_OUT)).toBe(false);
  });

  it("refuses marketing when there is no record at all", () => {
    // An address with no user behind it, such as a client accepting a quote.
    expect(maySend("MARKETING", null)).toBe(false);
  });

  it("allows marketing to somebody who did", () => {
    expect(maySend("MARKETING", OPTED_IN)).toBe(true);
  });

  it("refuses a flag with no date behind it", () => {
    // A true with no timestamp is a consent nobody can evidence, which is the
    // same as not having it.
    expect(maySend("MARKETING", { marketingOptIn: true, marketingOptInAt: null })).toBe(false);
  });

  it("treats exactly one kind as marketing", () => {
    // If a new kind is added and forgotten, it should default to being
    // transactional only if it genuinely is. This is the list to look at.
    expect(isTransactional("MARKETING")).toBe(false);
    for (const kind of [
      "PASSWORD_RESET",
      "QUOTE_ACCEPTED",
      "TEAM_INVITE",
      "NUDGE_TRACK_QUOTE",
      "NUDGE_DUE_SOON",
      "NUDGE_OVERDUE",
    ] as const) {
      expect(isTransactional(kind), kind).toBe(true);
    }
  });
});

describe("grant and withdraw", () => {
  it("records when and where consent was given", () => {
    // "They agreed" is not an answer to "when, and to what".
    const at = new Date("2026-08-14T10:00:00Z");
    expect(grant("signup", at)).toEqual({
      marketingOptIn: true,
      marketingOptInAt: at,
      marketingOptInSource: "signup",
    });
  });

  it("clears the date when consent is withdrawn", () => {
    // So a later opt-in records its own date rather than inheriting an old
    // one, and nothing can read a stale date as current.
    expect(withdraw()).toEqual({
      marketingOptIn: false,
      marketingOptInAt: null,
      marketingOptInSource: null,
    });
  });

  it("produces a withdrawal that maySend refuses", () => {
    expect(maySend("MARKETING", withdraw())).toBe(false);
  });
});

describe("the unsubscribe token", () => {
  it("is different every time, so one cannot be guessed from another", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newUnsubscribeToken()));
    expect(tokens.size).toBe(200);
  });

  it("is url-safe and long enough to be worth nothing to a guesser", () => {
    const token = newUnsubscribeToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(30);
  });
});
