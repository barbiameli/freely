import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestDb, testDb } from "../support/db";
import { createProject, createUser } from "../support/factories";
import { createCheckoutSessionAction } from "@/actions/invoice";
import {
  disconnectStripeAction,
  refreshStripeStatusAction,
  startStripeConnectAction,
  stripeDashboardAction,
} from "@/actions/account";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";
import type { User } from "@prisma/client";

/**
 * Money-touching code, so this runs against real Postgres rather than mocked
 * Prisma (ADR-0002). Only Stripe itself and the two Next.js request-scoped
 * APIs these actions touch are mocked: there is no real Stripe test account to
 * call, and no request to be inside of when a server action is invoked
 * directly from a test.
 */
const stripeMocks = vi.hoisted(() => ({
  checkoutSessionsCreate: vi.fn(),
  accountsCreate: vi.fn(),
  accountsRetrieve: vi.fn(),
  accountsCreateLoginLink: vi.fn(),
  accountLinksCreate: vi.fn(),
  webhooksConstructEvent: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

// Mutable rather than a hardcoded `true`, so the "Freely itself has no
// Stripe key" branch (isConnectAvailable() => false) is reachable from a test.
const platformState = vi.hoisted(() => ({ stripeConfigured: true }));

vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => platformState.stripeConfigured,
  getStripeClient: () => ({
    checkout: { sessions: { create: stripeMocks.checkoutSessionsCreate } },
    accounts: {
      create: stripeMocks.accountsCreate,
      retrieve: stripeMocks.accountsRetrieve,
      createLoginLink: stripeMocks.accountsCreateLoginLink,
    },
    accountLinks: { create: stripeMocks.accountLinksCreate },
    webhooks: { constructEvent: stripeMocks.webhooksConstructEvent },
  }),
}));
vi.mock("next-auth", () => ({ getServerSession: authMocks.getServerSession }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// A stand-in for real Stripe signature verification: valid iff the caller
// sent the sentinel signature, exactly like the real SDK is valid iff the
// signature matches the payload.
stripeMocks.webhooksConstructEvent.mockImplementation(
  (rawBody: string, signature: string) => {
    if (signature !== "valid-test-signature") {
      throw new Error("Webhook signature verification failed");
    }
    return JSON.parse(rawBody);
  }
);

function signInAs(user: User) {
  authMocks.getServerSession.mockResolvedValue({
    user: { id: user.id, email: user.email },
  });
}

const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
});

afterEach(async () => {
  vi.clearAllMocks();
  platformState.stripeConfigured = true;
  if (originalWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
  await resetTestDb();
});

describe("createCheckoutSessionAction", () => {
  it("creates a Checkout session on the freelancer's own connected account and marks the invoice pending", async () => {
    const user = await createUser({ stripeAccountId: "acct_ready", stripeChargesEnabled: true });
    const project = await createProject(user.id, {
      title: "Brand refresh",
      client: "Acme Co",
      price: 2500,
    });
    signInAs(user);
    stripeMocks.checkoutSessionsCreate.mockResolvedValueOnce({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/pay/cs_test_1",
    });

    const result = await createCheckoutSessionAction(project.id);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.url).toBe("https://checkout.stripe.com/pay/cs_test_1");

    expect(stripeMocks.checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 250000 }),
          }),
        ],
        metadata: { projectId: project.id },
      }),
      { stripeAccount: "acct_ready" }
    );

    const updated = await testDb.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(updated.stripeSessionId).toBe("cs_test_1");
    expect(updated.stripeCheckoutUrl).toBe("https://checkout.stripe.com/pay/cs_test_1");
    expect(updated.invoiceStatus).toBe("PENDING");
  });

  it("refuses when the freelancer hasn't connected Stripe", async () => {
    const user = await createUser();
    const project = await createProject(user.id, { price: 1000 });
    signInAs(user);

    const result = await createCheckoutSessionAction(project.id);

    expect(result.ok).toBe(false);
    expect(stripeMocks.checkoutSessionsCreate).not.toHaveBeenCalled();
    const untouched = await testDb.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(untouched.invoiceStatus).toBe("UNPAID");
  });

  it("refuses a project with no price set", async () => {
    const user = await createUser({ stripeAccountId: "acct_ready", stripeChargesEnabled: true });
    const project = await createProject(user.id, { price: 0 });
    signInAs(user);

    const result = await createCheckoutSessionAction(project.id);

    expect(result.ok).toBe(false);
    expect(stripeMocks.checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("refuses a project belonging to someone else", async () => {
    const owner = await createUser({ stripeAccountId: "acct_owner", stripeChargesEnabled: true });
    const project = await createProject(owner.id, { price: 500 });
    const stranger = await createUser();
    signInAs(stranger);

    const result = await createCheckoutSessionAction(project.id);

    expect(result.ok).toBe(false);
    expect(stripeMocks.checkoutSessionsCreate).not.toHaveBeenCalled();
  });
});

describe("Stripe webhook — checkout.session.completed", () => {
  function post(body: unknown, signature: string | null) {
    return stripeWebhook(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: signature ? { "stripe-signature": signature } : {},
        body: JSON.stringify(body),
      })
    );
  }

  it("marks the project's invoice paid when the payment lands on the matching Connect account", async () => {
    const user = await createUser({ stripeAccountId: "acct_match" });
    const project = await createProject(user.id, { invoiceStatus: "PENDING" });

    const res = await post(
      {
        type: "checkout.session.completed",
        account: "acct_match",
        data: {
          object: { metadata: { projectId: project.id }, payment_intent: "pi_test_1" },
        },
      },
      "valid-test-signature"
    );

    expect(res.status).toBe(200);
    const updated = await testDb.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(updated.invoiceStatus).toBe("PAID");
    expect(updated.stripePaymentIntentId).toBe("pi_test_1");

    const notification = await testDb.notification.findFirst({
      where: { userId: user.id, kind: "INVOICE_PAID", subjectId: project.id },
    });
    expect(notification).not.toBeNull();
  });

  it("does not mark paid when the event's account doesn't match the project owner's connected account", async () => {
    const user = await createUser({ stripeAccountId: "acct_real" });
    const project = await createProject(user.id, { invoiceStatus: "PENDING" });

    const res = await post(
      {
        type: "checkout.session.completed",
        account: "acct_attacker",
        data: {
          object: { metadata: { projectId: project.id }, payment_intent: "pi_test_2" },
        },
      },
      "valid-test-signature"
    );

    expect(res.status).toBe(200);
    const untouched = await testDb.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(untouched.invoiceStatus).toBe("PENDING");
  });

  it("rejects a request with an invalid signature and changes nothing", async () => {
    const user = await createUser({ stripeAccountId: "acct_match" });
    const project = await createProject(user.id, { invoiceStatus: "PENDING" });

    const res = await post(
      {
        type: "checkout.session.completed",
        account: "acct_match",
        data: { object: { metadata: { projectId: project.id }, payment_intent: "pi_test_3" } },
      },
      "not-the-right-signature"
    );

    expect(res.status).toBe(400);
    const untouched = await testDb.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(untouched.invoiceStatus).toBe("PENDING");
  });

  it("acknowledges an event type it doesn't act on without changing anything", async () => {
    const user = await createUser({ stripeAccountId: "acct_match" });
    const project = await createProject(user.id, { invoiceStatus: "PENDING" });

    const res = await post(
      { type: "account.updated", account: "acct_match", data: { object: {} } },
      "valid-test-signature"
    );

    expect(res.status).toBe(200);
    const untouched = await testDb.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(untouched.invoiceStatus).toBe("PENDING");
  });
});

describe("Stripe Connect account-state transitions", () => {
  describe("startStripeConnectAction", () => {
    it("creates a new connected account and returns an onboarding link", async () => {
      const user = await createUser();
      signInAs(user);
      stripeMocks.accountsCreate.mockResolvedValueOnce({ id: "acct_new_1" });
      stripeMocks.accountLinksCreate.mockResolvedValueOnce({
        url: "https://connect.stripe.com/setup/acct_new_1",
      });

      const result = await startStripeConnectAction();

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.url).toBe("https://connect.stripe.com/setup/acct_new_1");
      expect(stripeMocks.accountsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ email: user.email })
      );

      const updated = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.stripeAccountId).toBe("acct_new_1");
    });

    it("resumes onboarding for an account that already has an id, without creating a second one", async () => {
      const user = await createUser({ stripeAccountId: "acct_existing" });
      signInAs(user);
      stripeMocks.accountLinksCreate.mockResolvedValueOnce({
        url: "https://connect.stripe.com/setup/resume",
      });

      const result = await startStripeConnectAction();

      expect(result.ok).toBe(true);
      expect(stripeMocks.accountsCreate).not.toHaveBeenCalled();
      expect(stripeMocks.accountLinksCreate).toHaveBeenCalledWith(
        expect.objectContaining({ account: "acct_existing" })
      );

      const untouched = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(untouched.stripeAccountId).toBe("acct_existing");
    });

    it("refuses when Freely itself has no platform Stripe key", async () => {
      const user = await createUser();
      signInAs(user);
      platformState.stripeConfigured = false;

      const result = await startStripeConnectAction();

      expect(result.ok).toBe(false);
      expect(stripeMocks.accountsCreate).not.toHaveBeenCalled();
      const untouched = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(untouched.stripeAccountId).toBeNull();
    });
  });

  describe("refreshStripeStatusAction", () => {
    it("records Stripe's charges_enabled and stamps stripeConnectedAt when the account clears", async () => {
      const user = await createUser({
        stripeAccountId: "acct_x",
        stripeChargesEnabled: false,
        stripeConnectedAt: null,
      });
      signInAs(user);
      stripeMocks.accountsRetrieve.mockResolvedValueOnce({
        charges_enabled: true,
        details_submitted: true,
      });

      const result = await refreshStripeStatusAction();

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.ready).toBe(true);
      const updated = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.stripeChargesEnabled).toBe(true);
      expect(updated.stripeConnectedAt).not.toBeNull();
    });

    it("leaves stripeConnectedAt alone when Stripe still isn't clear", async () => {
      const user = await createUser({
        stripeAccountId: "acct_x",
        stripeChargesEnabled: false,
        stripeConnectedAt: null,
      });
      signInAs(user);
      stripeMocks.accountsRetrieve.mockResolvedValueOnce({
        charges_enabled: false,
        details_submitted: true,
      });

      const result = await refreshStripeStatusAction();

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.ready).toBe(false);
      const updated = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.stripeChargesEnabled).toBe(false);
      expect(updated.stripeConnectedAt).toBeNull();
    });

    it("reports not-ready without calling Stripe when no account is linked", async () => {
      const user = await createUser({ stripeAccountId: null });
      signInAs(user);

      const result = await refreshStripeStatusAction();

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.ready).toBe(false);
      expect(stripeMocks.accountsRetrieve).not.toHaveBeenCalled();
    });
  });

  describe("disconnectStripeAction", () => {
    it("clears the linked account on Freely without touching Stripe's own record of it", async () => {
      const user = await createUser({
        stripeAccountId: "acct_y",
        stripeChargesEnabled: true,
        stripeConnectedAt: new Date("2026-01-01T00:00:00Z"),
      });
      signInAs(user);

      const result = await disconnectStripeAction();

      expect(result.ok).toBe(true);
      const updated = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.stripeAccountId).toBeNull();
      expect(updated.stripeChargesEnabled).toBe(false);
      expect(updated.stripeConnectedAt).toBeNull();
    });
  });

  describe("stripeDashboardAction", () => {
    it("links to the freelancer's own Stripe dashboard for a connected account", async () => {
      const user = await createUser({ stripeAccountId: "acct_z" });
      signInAs(user);
      stripeMocks.accountsCreateLoginLink.mockResolvedValueOnce({
        url: "https://connect.stripe.com/express/acct_z",
      });

      const result = await stripeDashboardAction();

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.url).toBe("https://connect.stripe.com/express/acct_z");
      expect(stripeMocks.accountsCreateLoginLink).toHaveBeenCalledWith("acct_z");
    });

    it("refuses when no Stripe account is linked", async () => {
      const user = await createUser({ stripeAccountId: null });
      signInAs(user);

      const result = await stripeDashboardAction();

      expect(result.ok).toBe(false);
      expect(stripeMocks.accountsCreateLoginLink).not.toHaveBeenCalled();
    });
  });
});
