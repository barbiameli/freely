import { describe, it, expect, afterEach } from "vitest";
import { canTakePayments, connectState } from "@/lib/stripe-connect";

const KEY = "STRIPE_SECRET_KEY";
const original = process.env[KEY];

function platformConfigured(yes: boolean) {
  if (yes) process.env[KEY] = "sk_test_platform";
  else delete process.env[KEY];
}

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe("canTakePayments", () => {
  it("needs an account and Stripe's clearance", () => {
    platformConfigured(true);
    expect(
      canTakePayments({ stripeAccountId: "acct_1", stripeChargesEnabled: true })
    ).toBe(true);
  });

  it("refuses while Stripe is still checking", () => {
    // The dangerous state: an account exists, so it looks connected, but a
    // checkout built on it fails in front of the client.
    platformConfigured(true);
    expect(
      canTakePayments({ stripeAccountId: "acct_1", stripeChargesEnabled: false })
    ).toBe(false);
  });

  it("refuses with no account", () => {
    platformConfigured(true);
    expect(canTakePayments({ stripeAccountId: null, stripeChargesEnabled: true })).toBe(
      false
    );
  });

  it("refuses when Freely itself has no Stripe key", () => {
    // A stale chargesEnabled from a previous deployment must not survive the
    // platform key being pulled.
    platformConfigured(false);
    expect(
      canTakePayments({ stripeAccountId: "acct_1", stripeChargesEnabled: true })
    ).toBe(false);
  });
});

describe("connectState", () => {
  it("says nothing is on offer without a platform key", () => {
    platformConfigured(false);
    expect(connectState({ stripeAccountId: null, stripeChargesEnabled: false })).toBe(
      "unavailable"
    );
  });

  it("separates not started, in progress and done", () => {
    platformConfigured(true);
    expect(connectState({ stripeAccountId: null, stripeChargesEnabled: false })).toBe("none");
    expect(connectState({ stripeAccountId: "acct_1", stripeChargesEnabled: false })).toBe(
      "pending"
    );
    expect(connectState({ stripeAccountId: "acct_1", stripeChargesEnabled: true })).toBe(
      "ready"
    );
  });
});
