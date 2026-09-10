import { afterEach, describe, expect, it, vi } from "vitest";
import { resetTestDb, testDb } from "../support/db";

/**
 * The waitlist is the only unauthenticated write in the app.
 *
 * Everything else needs a session; this takes an email address from anybody
 * on the internet and puts a row in the database. Both of the properties that
 * make it safe to leave open are database-level — a unique index doing the
 * de-duplication, and a rate-limit row counting attempts — so neither can be
 * proved against a mocked Prisma (ADR-0002).
 */
vi.mock("next/headers", () => ({
  headers: () => ({ get: (key: string) => (key === "x-forwarded-for" ? "203.0.113.9" : null) }),
}));

import { joinWaitlistAction } from "@/actions/waitlist";

async function rows(email: string) {
  return testDb.$queryRawUnsafe<{ email: string; locale: string; createdAt: Date }[]>(
    `SELECT "email", "locale", "createdAt" FROM "Waitlist" WHERE email = $1`,
    email
  );
}

describe("joining the waitlist", () => {
  afterEach(async () => {
    await resetTestDb();
  });

  it("stores the address folded to lower case", async () => {
    const result = await joinWaitlistAction("  Barbara@Example.Test  ", "es");
    expect(result.ok).toBe(true);

    const found = await rows("barbara@example.test");
    expect(found).toHaveLength(1);
    expect(found[0].locale).toBe("es");
  });

  /*
   * The behaviour worth pinning down.
   *
   * A second submission is a success and leaves one row with its original
   * date. Two reasons: somebody who signed up last month and forgot wants to
   * be told they are on the list rather than told off, and an error that only
   * appears for addresses already in the table turns a public form into a way
   * of asking whether a given person uses Freely.
   */
  it("treats a repeat as success, keeps one row, keeps the first date", async () => {
    await joinWaitlistAction("twice@example.test", "en");
    const first = await rows("twice@example.test");

    const again = await joinWaitlistAction("twice@example.test", "en");
    expect(again.ok).toBe(true);

    const after = await rows("twice@example.test");
    expect(after).toHaveLength(1);
    expect(after[0].createdAt.getTime()).toBe(first[0].createdAt.getTime());
  });

  it("keeps an unknown locale out of the column", async () => {
    await joinWaitlistAction("locale@example.test", "klingon");
    expect((await rows("locale@example.test"))[0].locale).toBe("en");
  });

  it("refuses something that is not an address, and writes nothing", async () => {
    for (const bad of ["", "barbara", "barbara@", "@example.test", "a b@example.test"]) {
      const result = await joinWaitlistAction(bad, "en");
      expect({ bad, result }).toEqual({ bad, result: { ok: false, error: "wait.badEmail" } });
    }
    const count = await testDb.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "Waitlist"`
    );
    expect(Number(count[0].count)).toBe(0);
  });

  it("stops a script without stopping a person who mistypes twice", async () => {
    // Twenty a minute from one address. Three tries is a person.
    for (let i = 0; i < 3; i += 1) {
      const result = await joinWaitlistAction(`person-${i}@example.test`, "en");
      expect(result.ok).toBe(true);
    }

    // The twenty-first is not.
    for (let i = 3; i < 21; i += 1) {
      await joinWaitlistAction(`flood-${i}@example.test`, "en");
    }
    const blocked = await joinWaitlistAction("flood-last@example.test", "en");
    expect(blocked).toEqual({ ok: false, error: "wait.tooMany" });
  });
});
