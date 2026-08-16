import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

/**
 * Stripe telling us a client has paid.
 *
 * Payments happen on each freelancer's own connected account, so these arrive
 * as Connect events: same endpoint, same signing secret, but the event carries
 * an `account` naming whose account it happened on. In the Stripe dashboard
 * this endpoint has to be registered as a **Connect** endpoint, not an account
 * one, or nothing will ever be delivered here.
 *
 * Three things are checked before a project is marked paid, and each one is a
 * way this could otherwise be lied to:
 *
 * The signature, which is what makes the request Stripe rather than anybody who
 * knows the URL. Without it this endpoint marks any invoice paid on request.
 *
 * The project exists, from the id Stripe hands back in metadata.
 *
 * The account matches. A payment on somebody else's connected account has no
 * business marking this freelancer's invoice paid, and checking the owner is
 * what stops a project id leaking into the wrong account's event from settling
 * an invoice nobody paid.
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
    // Present on Connect events, naming the account the payment happened on.
    const account = event.account;

    if (projectId && account) {
      // The project and the account it should have been paid into, together,
      // so the two can be compared before anything is written.
      const project = (await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, user: { select: { stripeAccountId: true } } },
      } as unknown as { where: { id: string } })) as unknown as
        | { id: string; user: { stripeAccountId: string | null } }
        | null;

      if (project && project.user.stripeAccountId === account) {
        await prisma.project.update({
          where: { id: project.id },
          data: {
            invoiceStatus: "PAID",
            stripePaymentIntentId:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          },
        });
      }
    }
  }

  // Acknowledged either way. Returning an error for an event we chose not to
  // act on makes Stripe retry it for days and eventually disable the endpoint.
  return NextResponse.json({ received: true });
}
