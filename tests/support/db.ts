import { PrismaClient } from "@prisma/client";

/**
 * A Prisma client for integration tests, separate from the app's `@/lib/prisma`
 * singleton so tests don't inherit its dev-mode global caching. Points at
 * whatever `DATABASE_URL` is set to — the docker-compose Postgres locally, the
 * `postgres` service container in CI (see `.github/workflows/ci.yml`).
 */
export const testDb = new PrismaClient();

/**
 * Clears every row the factories in `./factories` can create.
 *
 * Team.ownerId is a required, non-cascading FK (a Team can't silently lose
 * its owner), so Team has to go before User — deleting it first also sets
 * any User.teamId pointing at it back to null (that side is optional, so
 * Prisma's default is SetNull). Everything else (Brief and its children,
 * Notification, etc.) cascades from User.
 *
 * Call from `afterEach` in any integration test that writes to the DB.
 */
export async function resetTestDb(): Promise<void> {
  await testDb.team.deleteMany();
  await testDb.user.deleteMany();
  // Not owned by a User — see ADR-0001 — so cascading delete never touches
  // it; it has to be cleared explicitly like Team and User are.
  await testDb.marketRateCache.deleteMany();
  // Also not owned by a User (see lib/rate-limit.ts) — the identifier is
  // folded into an opaque key, not a foreign key.
  await testDb.rateLimitHit.deleteMany();
  // The third of the same kind: somebody on the waitlist has no account yet,
  // by definition, so there is nothing for the User delete to cascade from.
  // Left out, a test asserting that a bad address writes nothing passes once
  // and then fails on every run after it.
  await (
    testDb as unknown as { waitlist: { deleteMany(): Promise<unknown> } }
  ).waitlist.deleteMany();
}
