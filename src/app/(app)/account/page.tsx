import { requireFullUser } from "@/lib/session";
import { connectState } from "@/lib/stripe-connect";
import { AccountView } from "./account-view";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { stripe?: string };
}) {
  const user = await requireFullUser();
  const connect = user as unknown as {
    stripeAccountId: string | null;
    stripeChargesEnabled: boolean;
  };

  return (
    <AccountView
      name={user.name}
      studioName={user.studioName}
      email={user.email}
      hasPassword={Boolean(user.passwordHash)}
      // Cast: both columns are newer than the generated Prisma client here.
      // Nudges default on, so an account predating the column reads as on.
      nudgeEmails={(user as unknown as { nudgeEmails?: boolean }).nudgeEmails !== false}
      marketingOptIn={Boolean(
        (user as unknown as { marketingOptIn?: boolean }).marketingOptIn
      )}
      stripeState={connectState(connect)}
      // Stripe sends people back here with this on the URL. Both values mean
      // the same thing to us: they have been away, so ask Stripe again.
      justReturnedFromStripe={
        searchParams.stripe === "return" || searchParams.stripe === "refresh"
      }
    />
  );
}
