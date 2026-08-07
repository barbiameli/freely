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
    />
  );
}
