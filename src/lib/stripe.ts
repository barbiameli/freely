import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazily constructs the Stripe client so importing this module never
 * requires the secret key to be present (useful in tests / when the
 * Stripe feature isn't configured yet). */
export function getStripeClient(): Stripe {
  if (!client) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to your .env file — see .env.example. Invoicing won't work until you do."
      );
    }
    client = new Stripe(secretKey);
  }
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
