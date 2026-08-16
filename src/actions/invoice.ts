"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import type { ActionResult } from "@/actions/briefs";

/**
 * Creates a Stripe Checkout session for a project's price and stores the
 * hosted payment link on the Project. Freely never touches card details or
 * custodies funds — it just hands off to Stripe's hosted page. Requires
 * STRIPE_SECRET_KEY to be set; until then this returns a clear error rather
 * than a confusing Stripe SDK crash.
 */
export async function createCheckoutSessionAction(
  projectId: string
): Promise<ActionResult<{ url: string }>> {
  const user = await requireFullUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...teamScopeWhere(user) },
  });
  if (!project) return { ok: false, error: "Project not found." };

  if (!isStripeConfigured()) {
    return {
      ok: false,
      error:
        "Online payment isn't switched on for this account yet. The invoice PDF still works.",
    };
  }
  if (project.price <= 0) {
    return { ok: false, error: "Set a price on this project before sending an invoice." };
  }

  const stripe = getStripeClient();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
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
    metadata: { projectId: project.id },
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
