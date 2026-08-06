import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

/**
 * Stripe webhook — marks a Project's invoice PAID once checkout completes.
 * Register this endpoint in the Stripe dashboard (or via `stripe listen`
 * for local dev) as {your domain}/api/webhooks/stripe, subscribed to at
 * least `checkout.session.completed`. STRIPE_WEBHOOK_SECRET must match the
 * signing secret Stripe gives you for that endpoint.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new NextResponse("Webhook not configured", { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return new NextResponse(
      `Webhook signature verification failed: ${err instanceof Error ? err.message : "unknown error"}`,
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const projectId = session.metadata?.projectId;
    if (projectId) {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          invoiceStatus: "PAID",
          stripePaymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
