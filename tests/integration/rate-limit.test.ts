import { afterEach, describe, expect, it } from "vitest";
import { resetTestDb, testDb } from "../support/db";
import { checkRateLimit, enforceLlmRateLimit, RateLimitError } from "@/lib/rate-limit";

/**
 * Backs the limiter with the real test Postgres (ADR-0002) rather than
 * mocking Prisma — the whole point of putting the counter in Postgres
 * instead of memory is that it has to hold across separate instances, and a
 * mocked upsert can't prove the atomic-increment behavior actually works.
 */
describe("checkRateLimit", () => {
  afterEach(async () => {
    await resetTestDb();
  });

  it("allows requests up to the limit", async () => {
    for (let i = 0; i < 3; i++) {
      await expect(
        checkRateLimit("test-scope", "user-1", { limit: 3, windowMs: 60_000 })
      ).resolves.toBeUndefined();
    }
  });

  it("throws once a caller goes over the limit within the window", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("test-scope", "user-1", { limit: 3, windowMs: 60_000 });
    }

    await expect(
      checkRateLimit("test-scope", "user-1", { limit: 3, windowMs: 60_000 })
    ).rejects.toThrow(RateLimitError);
  });

  it("reports a positive retryAfterSeconds on the thrown error", async () => {
    await checkRateLimit("test-scope", "user-1", { limit: 1, windowMs: 60_000 });

    try {
      await checkRateLimit("test-scope", "user-1", { limit: 1, windowMs: 60_000 });
      expect.unreachable("expected checkRateLimit to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("keeps separate identifiers under the same scope from sharing a budget", async () => {
    await checkRateLimit("test-scope", "user-1", { limit: 1, windowMs: 60_000 });

    await expect(
      checkRateLimit("test-scope", "user-2", { limit: 1, windowMs: 60_000 })
    ).resolves.toBeUndefined();
  });

  it("keeps separate scopes for the same identifier from sharing a budget", async () => {
    await checkRateLimit("scope-a", "user-1", { limit: 1, windowMs: 60_000 });

    await expect(
      checkRateLimit("scope-b", "user-1", { limit: 1, windowMs: 60_000 })
    ).resolves.toBeUndefined();
  });

  // The time is passed rather than waited for.
  //
  // This used to make two quick calls with a 50ms window and expect the second
  // to be refused, then sleep and expect a third to pass. A fixed window is a
  // slice of the wall clock, so the first two landed in different buckets
  // whenever a boundary happened to fall between them, and the second call was
  // allowed. Correct code, failing test, roughly one run in ten.
  it("resets once the window has passed", async () => {
    const windowMs = 60_000;
    // Deliberately mid-window, so nothing here depends on where the real
    // clock happens to be when the suite runs.
    const start = 1_000_000 * windowMs + windowMs / 2;

    await checkRateLimit("test-scope", "user-1", { limit: 1, windowMs, now: start });
    await expect(
      checkRateLimit("test-scope", "user-1", { limit: 1, windowMs, now: start + 1 })
    ).rejects.toThrow(RateLimitError);

    await expect(
      checkRateLimit("test-scope", "user-1", { limit: 1, windowMs, now: start + windowMs })
    ).resolves.toBeUndefined();
  });

  // The cost of a fixed window, stated rather than discovered. Somebody at a
  // boundary gets up to twice the limit in quick succession. That is an
  // accepted trade for the check being one atomic upsert with no
  // read-modify-write race, and it should fail loudly if it ever changes.
  it("allows twice the limit across a boundary, which is the known trade", async () => {
    const windowMs = 60_000;
    const boundary = 1_000_000 * windowMs;

    await checkRateLimit("test-scope", "user-1", { limit: 1, windowMs, now: boundary - 1 });
    await expect(
      checkRateLimit("test-scope", "user-1", { limit: 1, windowMs, now: boundary })
    ).resolves.toBeUndefined();
  });
});

describe("enforceLlmRateLimit", () => {
  afterEach(async () => {
    await resetTestDb();
  });

  it("shares one budget across every LLM-calling action for a user", async () => {
    for (let i = 0; i < 12; i++) {
      await enforceLlmRateLimit("user-1");
    }

    await expect(enforceLlmRateLimit("user-1")).rejects.toThrow(RateLimitError);
    // One row per (scope, identifier, window bucket) — not per call — proving
    // the budget really is shared rather than each call getting its own
    // counter. Two rows total: the per-user "llm" row and the "llm-global"
    // row every call also increments.
    expect(await testDb.rateLimitHit.count()).toBe(2);
  });

  it("doesn't rate-limit one user's calls against another user's budget", async () => {
    for (let i = 0; i < 12; i++) {
      await enforceLlmRateLimit("user-1");
    }

    await expect(enforceLlmRateLimit("user-2")).resolves.toBeUndefined();
  });

  it("also enforces a global ceiling shared across every user", async () => {
    // 4 users x 10 calls each stays under each user's own 12/min budget but
    // hits the account-wide 40/min ceiling on the 41st call overall.
    const users = ["user-1", "user-2", "user-3", "user-4"];
    for (const user of users) {
      for (let i = 0; i < 10; i++) {
        await enforceLlmRateLimit(user);
      }
    }

    await expect(enforceLlmRateLimit("user-5")).rejects.toThrow(RateLimitError);
  });
});
