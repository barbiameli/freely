/**
 * Whether an address is the one person who runs Freely.
 *
 * Its own module because both lib/auth and lib/session need it, and it living
 * in either of them made the two import each other. A leaf with no imports of
 * its own cannot be part of a cycle.
 */
export function isAdminEmail(email: string): boolean {
  const admin = process.env.ADMIN_EMAIL;
  return Boolean(admin && email.toLowerCase() === admin.toLowerCase());
}
