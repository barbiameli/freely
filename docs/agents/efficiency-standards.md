# Efficiency standards

Foundational rules for cost, speed, and reliability, set while the app is pre-launch so they don't have to be retrofitted under real traffic. See `docs/adr/0001-market-rate-cache.md` and `docs/adr/0002-integration-tests-real-postgres.md` for the two decisions behind these that were hard enough to reverse to write down.

## Model choice

Two models exist for a reason (`src/lib/anthropic.ts`): Haiku (`SMALL_MODEL`) for extraction and short rewrites, Sonnet (`MODEL`) for judgment. Default new LLM calls to Haiku; only reach for Sonnet when the task genuinely requires judgment, not just because it's the model already in scope.

## Observability

Every LLM call goes through `loggedCreate` in `anthropic.ts` (directly, or via the `callClaude` helper) — model, tokens in/out, latency, and a rough $ estimate, logged as `[llm]`. Don't call the Anthropic SDK directly from a new call site; route it through `loggedCreate` instead. Without this, "did that change help" is a guess.

## Don't add work to the critical path by default

No new LLM or third-party network call gets added to a synchronous, user-facing request path without a stated reason — prefer async/backgrounded where the UX allows it. No network call gets added inside a loop over user data without an explicit caching or batching justification, since there's currently no caching layer to absorb the repeat cost.

## Ship in small, revertible pieces

There's no staging environment — every merge to main goes to production. Keep PRs scoped to one concern, small enough to revert on their own if something breaks.

## Test what changes

New server actions or routes that touch the database or Stripe ship with an integration test against the real Postgres test DB (see ADR-0002) — not a test that mocks Prisma. CI (lint + test) must pass before merge; this isn't optional given multiple agent sessions push to the same branch.

## Use the project's vocabulary

Use `CONTEXT.md`'s terms — Quote, Public Quote, Draft — in new code, UI copy, and issue titles. Not "Brief" (the DB model's name only) or "Offer" (retired).
