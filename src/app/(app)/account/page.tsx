import { requireFullUser } from "@/lib/session";
import { AccountView } from "./account-view";

export default async function AccountPage() {
  const user = await requireFullUser();

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
    />
  );
}
