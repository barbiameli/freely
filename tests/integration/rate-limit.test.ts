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

  it("resets once the window has passed", async () => {
    const windowMs = 50;
    await checkRateLimit("test-scope", "user-1", { limit: 1, windowMs });
    await expect(
      checkRateLimit("test-scope", "user-1", { limit: 1, windowMs })
    ).rejects.toThrow(RateLimitError);

    await new Promise((resolve) => setTimeout(resolve, windowMs * 2));

    await expect(
      checkRateLimit("test-scope", "user-1", { limit: 1, windowMs })
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
