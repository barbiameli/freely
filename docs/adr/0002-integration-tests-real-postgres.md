# Integration tests run against a real Postgres, not mocked Prisma

The existing suite (584 tests) covers only pure functions — nothing exercises a server action, the Anthropic wrapper, Stripe, auth, or the public quote page, because nothing mocks Prisma or the Anthropic SDK. This is the likely source of "bugs on every new feature or change": correct unit tests, near-zero coverage of the paths that actually break.

New integration tests will run against a real Postgres test database (reusing the existing `docker-compose.yml` service, matching the Neon/Postgres used in production) rather than mocking Prisma. This is deliberate: mocked-Prisma tests can pass while the real query is wrong — the exact failure mode this project has been hitting — and a real DB in CI costs nothing extra to run since the container definition already exists.

## Amendment, 2026-09-10: the tests must refuse a managed database

`resetTestDb` deletes every User. `.env` in this repo points `DATABASE_URL` at the production Neon database, because that is what `prisma db push` and `next dev` need day to day. Nothing connected those two facts, and running `npx vitest run tests/integration` locally without overriding the variable deleted every real account.

CI was never at risk: `.github/workflows/ci.yml` sets `DATABASE_URL` to the service container explicitly. The gap was a local run, where the variable is already set to something and so nothing looks missing.

`tests/support/db.ts` now throws before Prisma connects if the URL names a managed host, and the error carries the command to run instead. A blocklist rather than an allowlist on purpose: a new local setup should not have to be added to a list to be allowed, but a managed host should never become reachable by forgetting an environment variable.

The command to use locally:

```
docker compose up -d
DATABASE_URL=postgresql://freely:freely@localhost:5432/freely npx vitest run tests/integration
```
