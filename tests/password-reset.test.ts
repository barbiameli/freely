import { describe, it, expect } from "vitest";
import {
  newResetToken,
  hashToken,
  tokensMatch,
  checkReset,
  expiryFrom,
  tooManyRequests,
  passwordProblem,
  RESET_TTL_MS,
  MAX_REQUESTS,
} from "@/lib/password-reset";

describe("the token", () => {
  it("is long and different every time", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newResetToken()));
    expect(tokens.size).toBe(200);
    expect(newResetToken().length).toBeGreaterThanOrEqual(40);
  });

  it("is url-safe, since it travels in a link", () => {
    for (let i = 0; i < 50; i++) {
      expect(newResetToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("hashes to something that is not the token", () => {
    // What the database holds must be useless to whoever reads the database.
    const token = newResetToken();
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toHaveLength(64);
  });

  it("hashes the same input to the same thing, and different inputs apart", () => {
    const a = newResetToken();
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(newResetToken()));
  });
});

describe("tokensMatch", () => {
  it("matches a token with itself", () => {
    const hash = hashToken(newResetToken());
    expect(tokensMatch(hash, hash)).toBe(true);
  });

  it("rejects a different token", () => {
    expect(tokensMatch(hashToken("a"), hashToken("b"))).toBe(false);
  });

  it("returns false rather than throwing on a length mismatch", () => {
    // timingSafeEqual throws on unequal lengths, and an exception here would
    // itself tell somebody something.
    expect(tokensMatch("short", hashToken("a"))).toBe(false);
  });
});

const now = new Date("2026-08-14T12:00:00Z");

describe("checkReset", () => {
  it("accepts a fresh unused token", () => {
    expect(
      checkReset({ tokenHash: "x", expiresAt: expiryFrom(now), usedAt: null }, now)
    ).toEqual({ ok: true });
  });

  it("refuses one that has already been spent", () => {
    // A reset link is single use. An email in an inbox must not still open the
    // account a month later because nobody clicked it twice.
    expect(
      checkReset({ tokenHash: "x", expiresAt: expiryFrom(now), usedAt: now }, now)
    ).toEqual({ ok: false, problem: "used" });
  });

  it("refuses one that has expired", () => {
    const expired = new Date(now.getTime() - 1000);
    expect(checkReset({ tokenHash: "x", expiresAt: expired, usedAt: null }, now)).toEqual({
      ok: false,
      problem: "expired",
    });
  });

  it("treats the exact moment of expiry as expired", () => {
    const at = new Date(now.getTime());
    expect(checkReset({ tokenHash: "x", expiresAt: at, usedAt: null }, now).ok).toBe(false);
  });

  it("refuses a token nobody has heard of", () => {
    expect(checkReset(null, now)).toEqual({ ok: false, problem: "unknown" });
  });

  it("expires within the hour", () => {
    expect(expiryFrom(now).getTime() - now.getTime()).toBe(RESET_TTL_MS);
    expect(RESET_TTL_MS).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});

describe("tooManyRequests", () => {
  it("allows a normal number of tries", () => {
    // Asking twice because the first email went to spam is not an attack.
    const recent = [new Date(now.getTime() - 60_000), new Date(now.getTime() - 30_000)];
    expect(tooManyRequests(recent, now)).toBe(false);
  });

  it("stops somebody hammering the form", () => {
    // Unlimited requests make this a way to mailbomb an address, and a way to
    // learn which addresses have accounts.
    const recent = Array.from({ length: MAX_REQUESTS }, (_, i) => new Date(now.getTime() - i * 1000));
    expect(tooManyRequests(recent, now)).toBe(true);
  });

  it("forgets about old attempts", () => {
    const old = Array.from(
      { length: MAX_REQUESTS },
      () => new Date(now.getTime() - 2 * 60 * 60 * 1000)
    );
    expect(tooManyRequests(old, now)).toBe(false);
  });

  it("is fine with somebody who has never asked", () => {
    expect(tooManyRequests([], now)).toBe(false);
  });
});

describe("passwordProblem", () => {
  it("wants a real length", () => {
    expect(passwordProblem("short")).toBe("short");
    expect(passwordProblem("")).toBe("short");
  });

  it("accepts a long passphrase without composition rules", () => {
    // Rules about symbols produce "Password1!", which is worse than a long
    // thing somebody can actually remember.
    expect(passwordProblem("correct horse battery staple")).toBeNull();
  });
});
