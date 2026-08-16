import type Stripe from "stripe";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";

/**
 * Each freelancer's own Stripe account, linked to Freely.
 *
 * The arrangement matters, so it is worth stating plainly. Freely has one
 * Stripe account, the platform. Every freelancer links their own. When a client
 * pays an invoice, the charge is created *on the freelancer's account*, so the
 * money goes from the client to the freelancer and Freely is never holding it.
 *
 * That is not a technical preference. Taking somebody's client's money into our
 * account and paying it on afterwards is money transmission, which is licensed
 * work in most countries. Direct charges keep Freely as software.
 *
 * What Freely stores is the account id Stripe hands back. It is an identifier,
 * not a credential: it authorises nothing on its own, and every call using it is
 * signed with the platform key. No bank details and no card details are stored
 * here, which is the same rule the invoice PDF follows.
 */

/** Whether the platform itself can talk to Stripe at all. */
export function isConnectAvailable(): boolean {
  return isStripeConfigured();
}

/**
 * An account for a freelancer who has not linked one yet.
 *
 * Express rather than Standard: Stripe hosts the sign-up, the identity checks
 * and the payout settings, so Freely never sees a document or a bank number, and
 * a freelancer without a Stripe account can make one on the way through rather
 * than being told to go and get one first.
 *
 * The email is prefilled to save typing, and because a mismatch between the
 * Freely login and the Stripe account is a support conversation nobody enjoys.
 */
export async function createConnectedAccount(email: string): Promise<string> {
  const stripe = getStripeClient();
  const account = await stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      product_description: "Freelance services invoiced through Freely.",
    },
  });
  return account.id;
}

/**
 * The link that takes somebody to Stripe to finish signing up.
 *
 * Single use and short lived, by Stripe's design, which is why it is built on
 * demand rather than stored. Both URLs come back to the same settings page:
 * refresh when the link has gone stale, return when Stripe is done, and neither
 * is a promise that the account was approved, only that the person came back.
 * Whether they can actually take money is read from Stripe afterwards.
 */
export async function onboardingLink(
  accountId: string,
  appUrl: string
): Promise<string> {
  const stripe = getStripeClient();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/account?stripe=refresh`,
    return_url: `${appUrl}/account?stripe=return`,
    type: "account_onboarding",
  });
  return link.url;
}

/** Where a connected freelancer manages payouts, refunds and their details. */
export async function dashboardLink(accountId: string): Promise<string> {
  const stripe = getStripeClient();
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

export interface ConnectStatus {
  /** Stripe will let this account take payments right now. */
  chargesEnabled: boolean;
  /** Stripe still wants something before it will. */
  detailsSubmitted: boolean;
}

/**
 * What Stripe currently thinks of an account.
 *
 * Asked rather than remembered. Stripe can suspend an account for its own
 * reasons long after onboarding, and a Pay button based on a flag we set weeks
 * ago is a checkout that fails in front of somebody's client.
 */
export async function connectStatus(accountId: string): Promise<ConnectStatus> {
  const stripe = getStripeClient();
  const account: Stripe.Account = await stripe.accounts.retrieve(accountId);
  return {
    chargesEnabled: Boolean(account.charges_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
  };
}

/**
 * Whether an invoice may offer online payment.
 *
 * Both halves are required. An account id with the checks unfinished is the
 * common state for the first day or two after signing up, and it is exactly the
 * state where a Pay button does the most damage.
 */
export function canTakePayments(user: {
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
}): boolean {
  return Boolean(isConnectAvailable() && user.stripeAccountId && user.stripeChargesEnabled);
}

/**
 * Where a freelancer is in the process, as one word the UI can switch on.
 *
 * "unavailable" is the platform's own key being absent, which is a Freely
 * problem rather than theirs, so the settings page says nothing about payments
 * at all instead of offering a button that cannot work.
 */
export type ConnectState = "unavailable" | "none" | "pending" | "ready";

export function connectState(user: {
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
}): ConnectState {
  if (!isConnectAvailable()) return "unavailable";
  if (!user.stripeAccountId) return "none";
  return user.stripeChargesEnabled ? "ready" : "pending";
}
