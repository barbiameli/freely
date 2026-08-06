"use server";

import { redirect } from "next/navigation";

/** Server action used by a plain <form> to sign the user out without
 * needing a client component wrapper around next-auth/react's signOut. */
export async function signOutAction() {
  redirect("/api/auth/signout?callbackUrl=/signin");
}
