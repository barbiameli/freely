import { afterEach, describe, expect, it, vi } from "vitest";
import { resetTestDb, testDb } from "../support/db";
import { createQuote, createTeam, createUser } from "../support/factories";
import PublicQuotePage from "@/app/q/[slug]/page";
import { acceptQuoteAction } from "@/actions/acceptance";

/**
 * The Public Quote page and its acceptance action are the app's trust-critical
 * surface — a client, not the freelancer, is looking at this — so these run
 * against real Postgres rather than mocked Prisma (see ADR-0002). Only the
 * two Next.js request-scoped APIs the acceptance action touches
 * (`next/headers`, `next/cache`) are mocked: there's no request to be inside
 * of when a server action is called directly from a test.
 */
vi.mock("next/headers", () => ({
  headers: () => ({
    get: (key: string) => (key === "x-forwarded-for" ? "203.0.113.5, 10.0.0.1" : null),
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

describe("Public Quote page", () => {
  afterEach(async () => {
    await resetTestDb();
  });

  it("renders a published Quote at its public slug", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const quote = await createQuote(user.id, {
      title: "Marketing site rebrand",
      price: 4200,
      hours: 42,
      published: true,
      settings: { includeSOW: true },
    });

    const element = (await PublicQuotePage({
      params: { slug: quote.publicSlug },
    })) as unknown as { props: { children: { props: { brief: Record<string, unknown> } } } };

    const brief = element.props.children.props.brief;
    expect(brief.title).toBe("Marketing site rebrand");
    expect(brief.price).toBe(4200);
    expect(brief.slug).toBe(quote.publicSlug);
    // Signing is only offered when the quote carries a Statement of Work.
    expect(brief.signable).toBe(true);
    expect(brief.accepted).toBeNull();
  });

  it("keeps an unpublished Quote unreachable at its slug", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const quote = await createQuote(user.id, { published: false });

    await expect(PublicQuotePage({ params: { slug: quote.publicSlug } })).rejects.toThrow();
  });

  it("keeps a nonexistent slug unreachable", async () => {
    await expect(
      PublicQuotePage({ params: { slug: "no-such-quote-slug" } })
    ).rejects.toThrow();
  });
});

describe("acceptQuoteAction", () => {
  afterEach(async () => {
    await resetTestDb();
  });

  it("records the client's electronic signature on a published Quote", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const quote = await createQuote(user.id, { published: true });

    const result = await acceptQuoteAction(quote.publicSlug, "Jamie Client", "jamie@example.test");

    expect(result.ok).toBe(true);

    const updated = await testDb.brief.findUniqueOrThrow({ where: { id: quote.id } });
    expect(updated.acceptedName).toBe("Jamie Client");
    expect(updated.acceptedEmail).toBe("jamie@example.test");
    expect(updated.acceptedAt).not.toBeNull();
    // Vercel forwards the client address as the first hop in a
    // comma-separated chain.
    expect(updated.acceptedIp).toBe("203.0.113.5");
    expect(updated.outcome).toBe("WON");
  });

  it("refuses to accept an unpublished Quote", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const quote = await createQuote(user.id, { published: false });

    const result = await acceptQuoteAction(quote.publicSlug, "Jamie Client", "jamie@example.test");

    expect(result.ok).toBe(false);

    const untouched = await testDb.brief.findUniqueOrThrow({ where: { id: quote.id } });
    expect(untouched.acceptedAt).toBeNull();
  });

  it("refuses a second acceptance of an already-accepted Quote", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const quote = await createQuote(user.id, {
      published: true,
      acceptedAt: new Date("2026-01-01T00:00:00Z"),
      acceptedName: "First Signer",
      acceptedEmail: "first@example.test",
    });

    const result = await acceptQuoteAction(quote.publicSlug, "Second Signer", "second@example.test");

    expect(result.ok).toBe(false);

    const untouched = await testDb.brief.findUniqueOrThrow({ where: { id: quote.id } });
    expect(untouched.acceptedName).toBe("First Signer");
  });

  it("rejects an invalid email without recording anything", async () => {
    const user = await createUser();
    await createTeam(user.id);
    const quote = await createQuote(user.id, { published: true });

    const result = await acceptQuoteAction(quote.publicSlug, "Jamie Client", "not-an-email");

    expect(result.ok).toBe(false);

    const untouched = await testDb.brief.findUniqueOrThrow({ where: { id: quote.id } });
    expect(untouched.acceptedAt).toBeNull();
  });
});
