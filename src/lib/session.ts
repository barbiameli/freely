import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Returns the signed-in user's session, or null if not signed in. */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

/** Use in server components/actions that require auth. Redirects to /signin otherwise. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}

/** Loads the full User record (including memoryInstructions) for the signed-in user. */
export async function requireFullUser() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) redirect("/signin");
  return user;
}

/**
 * Whether this is the account that may see the product's own dashboard.
 *
 * Read from ADMIN_EMAIL on the server. Unset means nobody, which is the right
 * default for a page that shows what every account is doing.
 */
// Lives in lib/admin so lib/auth can read it without importing this file.
export { isAdminEmail } from "@/lib/admin";
