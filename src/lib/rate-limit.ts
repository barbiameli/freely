import { prisma } from "@/lib/prisma";

/** Thrown by `checkRateLimit` when the caller is over budget. Server actions
 * already catch `Error` and surface `.message` as the user-facing string
 * (see generateBriefAction and friends), so this needs no special handling
 * at the call site beyond the existing try/catch. */
export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      `You're sending requests faster than the AI can keep up. Try again in ${retryAfterSeconds}s.`
    );
    this.name = "RateLimitError";
  }
}

/** Old windows are just rows nothing reads anymore, not state that needs
 * resetting — swept out occasionally so the table doesn't grow forever.
 * Run on a small fraction of calls rather than every one, since exactness
 * doesn't matter for a cleanup sweep. */
const CLEANUP_SAMPLE_RATE = 0.02;
const CLEANUP_RETENTION_WINDOWS = 10;

// Fire-and-forget from checkRateLimit, so a failure here must never become
// an unhandled rejection on the request path — it's a background sweep, not
// something the caller is waiting on or should fail for.
function sweepExpiredHits(windowMs: number): void {
  if (Math.random() >= CLEANUP_SAMPLE_RATE) return;
  const cutoff = new Date(Date.now() - windowMs * CLEANUP_RETENTION_WINDOWS);
  prisma.rateLimitHit
    .deleteMany({ where: { createdAt: { lt: cutoff } } })
    .catch((err) => console.error("[rate-limit] cleanup sweep failed", err));
}

/**
 * Fixed-window rate limit backed by Postgres, so the limit holds across
 * every serverless instance rather than resetting per cold start.
 *
 * The window is folded into the row's key (`${scope}:${identifier}:${bucket}`)
 * rather than tracked with a separate "window started at" column: that turns
 * the check into a single atomic upsert-and-increment (Postgres INSERT ...
 * ON CONFLICT under the hood), with no read-modify-write race between two
 * requests arriving at once.
 *
 * Throws `RateLimitError` when the identifier is over `limit` requests within
 * `windowMs`; otherwise resolves.
 */
export async function checkRateLimit(
  scope: string,
  identifier: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<void> {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const key = `${scope}:${identifier}:${bucket}`;

  const hit = await prisma.rateLimitHit.upsert({
    where: { key },
    create: { key, count: 1 },
    update: { count: { increment: 1 } },
  });

  sweepExpiredHits(windowMs);

  if (hit.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000));
    throw new RateLimitError(retryAfterSeconds);
  }
}

/** Every LLM-calling server action shares this one budget per user, rather
 * than each action getting its own: what's actually being protected is one
 * Anthropic account's rate-limit tier (issue #9), and a per-action limit
 * would let someone hit the same total rate by spreading calls across
 * actions instead of hammering one. 12/min is well above any real usage
 * (each action fires at most a few times a minute even used by hand) and
 * well below where an accidental retry loop would start denting the tier. */
const LLM_RATE_LIMIT = { limit: 12, windowMs: 60_000 };

/** A second, coarser ceiling shared by every user, not just each user's own
 * budget above: the thing actually being protected is one Anthropic account
 * on one rate-limit tier, and that tier's limit is account-wide, not
 * per-user. A handful of users each safely under their own 12/min could
 * still add up past what a minimum tier allows, so this catches the sum
 * rather than just each individual caller. Wide enough that normal
 * multi-user usage never touches it. */
const LLM_GLOBAL_RATE_LIMIT = { limit: 40, windowMs: 60_000 };
const GLOBAL_IDENTIFIER = "all-users";

export async function enforceLlmRateLimit(userId: string): Promise<void> {
  await checkRateLimit("llm-global", GLOBAL_IDENTIFIER, LLM_GLOBAL_RATE_LIMIT);
  await checkRateLimit("llm", userId, LLM_RATE_LIMIT);
}
