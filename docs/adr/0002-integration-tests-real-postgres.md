# Integration tests run against a real Postgres, not mocked Prisma

The existing suite (584 tests) covers only pure functions — nothing exercises a server action, the Anthropic wrapper, Stripe, auth, or the public quote page, because nothing mocks Prisma or the Anthropic SDK. This is the likely source of "bugs on every new feature or change": correct unit tests, near-zero coverage of the paths that actually break.

New integration tests will run against a real Postgres test database (reusing the existing `docker-compose.yml` service, matching the Neon/Postgres used in production) rather than mocking Prisma. This is deliberate: mocked-Prisma tests can pass while the real query is wrong — the exact failure mode this project has been hitting — and a real DB in CI costs nothing extra to run since the container definition already exists.
