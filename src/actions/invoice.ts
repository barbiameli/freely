"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { getStripeClient } from "@/lib/stripe";
import { canTakePayments } from "@/lib/stripe-connect";
import { appUrl } from "@/lib/email";
import type { ActionResult } from "@/actions/briefs";

/**
 * Creates a checkout page for this project's price, on the freelancer's own
 * Stripe account.
 *
 * The charge is created directly on their account, so their client's money goes
 * to them. Freely never receives it, never holds it, and never pays it on,
 * which is the difference between being software and being a payment business.
 *
 * Both the account and Stripe's clearance are required: an account halfway
 * through its checks produces a checkout page that fails in front of a client,
 * which is worse than no button at all.
 */
export async function createCheckoutSessionAction(
  projectId: string
): Promise<ActionResult<{ url: string }>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
  });
  if (!project) return { ok: false, error: "Project not found." };

  if (!canTakePayments(user as unknown as {
    stripeAccountId: string | null;
    stripeChargesEnabled: boolean;
  })) {
    return {
      ok: false,
      error:
        "Connect your Stripe account in Account settings to take card payments. The invoice PDF works either way.",
    };
  }
  if (project.price <= 0) {
    return { ok: false, error: "Set a price on this project before sending an invoice." };
  }

  const stripe = getStripeClient();
  const baseUrl = appUrl();
  const account = (user as unknown as { stripeAccountId: string }).stripeAccountId;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          // The quote's currency, rather than a hardcoded USD. Charging a
          // London client in dollars for a quote written in pounds is both
          // the wrong amount and an obvious mistake to whoever is paying.
          currency: project.currency.toLowerCase(),
          unit_amount: Math.round(project.price * 100),
          product_data: {
            name: project.title,
            description: `Invoice for ${project.client}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/track/${project.id}/invoice?paid=1`,
    cancel_url: `${baseUrl}/track/${project.id}/invoice`,
    // Read back on the webhook, which is the only thing tying a completed
    // payment to a project in this database.
    metadata: { projectId: project.id },
  }, {
    // On their account, not Freely's.
    stripeAccount: account,
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      stripeSessionId: session.id,
      stripeCheckoutUrl: session.url,
      invoiceStatus: "PENDING",
    },
  });

  revalidatePath(`/track/${project.id}/invoice`);

  if (!session.url) return { ok: false, error: "Stripe didn't return a checkout URL." };
  return { ok: true, data: { url: session.url } };
}
