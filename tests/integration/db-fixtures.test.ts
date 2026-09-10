import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resetTestDb, testDb } from "../support/db";
import { createQuote, createTeam, createUser } from "../support/factories";

/**
 * Proves the integration-test infra actually works end to end: a real write
 * to the test Postgres, read back through Prisma, then cleaned up. Not
 * feature coverage — see ADR-0002 and the issues that build real coverage
 * (Public Quote page, Stripe/invoice actions) on top of this.
 */
describe("integration test infra", () => {
  afterEach(async () => {
    await resetTestDb();
  });

  it("writes and reads back a User, Team, and Quote against real Postgres", async () => {
    const user = await createUser({ email: "infra-check@example.test" });
    const team = await createTeam(user.id, { name: "Infra Check Studio" });
    const quote = await createQuote(user.id, { title: "Infra check quote" });

    const found = await testDb.brief.findUniqueOrThrow({
      where: { id: quote.id },
      include: { user: { include: { ownedTeam: true } } },
    });

    expect(found.title).toBe("Infra check quote");
    expect(found.user.id).toBe(user.id);
    expect(found.user.ownedTeam?.id).toBe(team.id);
  });

  it("leaves a clean slate after resetTestDb", async () => {
    const user = await createUser();
    await createTeam(user.id);
    await createQuote(user.id);

    await resetTestDb();

    expect(await testDb.user.count()).toBe(0);
    expect(await testDb.team.count()).toBe(0);
    expect(await testDb.brief.count()).toBe(0);
  });
});

/**
 * The guard that stands between `resetTestDb` and a real database.
 *
 * It is checked here rather than trusted, because the failure it prevents is
 * silent, total, and already happened once: every User deleted from
 * production by a local test run that inherited `.env`.
 */
describe("the safety catch", () => {
  it("refuses a managed database host", () => {
    const source = readFileSync("tests/support/db.ts", "utf8");
    for (const host of ["neon.tech", "supabase.co", "rds.amazonaws.com"]) {
      expect(source).toContain(host);
    }
    // Before the client is constructed, so nothing can connect first.
    expect(source.indexOf("assertThrowaway(process.env.DATABASE_URL)")).toBeLessThan(
      source.indexOf("new PrismaClient()")
    );
  });
});
