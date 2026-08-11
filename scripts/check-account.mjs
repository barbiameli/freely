/**
 * Is the account still there, and does it still have a password?
 *
 * Sign-in fails with the same message for three different reasons: no account
 * with that email, an account with no password set, and a wrong password. That
 * is right for a login form, where saying which one is a gift to whoever is
 * guessing, and useless when you are the one locked out.
 *
 * So this says which. It reads DATABASE_URL from .env, prints nothing secret,
 * and never prints or checks a password: only whether a hash exists.
 *
 *   node scripts/check-account.mjs you@example.com
 */
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error("Usage: node scripts/check-account.mjs you@example.com");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const total = await prisma.user.count();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, createdAt: true },
  });

  console.log(`Accounts in the database: ${total}`);

  if (total === 0) {
    console.log("");
    console.log("The users table is empty. The database was reset at some point,");
    console.log("which is why the password looks wrong: there is no account to");
    console.log("check it against. Sign up again with the same email.");
    process.exit(0);
  }

  if (!user) {
    console.log("");
    console.log(`No account with the email "${email}".`);
    console.log("Other accounts exist, so the database is intact. Check the");
    console.log("spelling, or list them with: node scripts/check-account.mjs --list");
    process.exit(0);
  }

  console.log(`Found: ${user.email}, created ${user.createdAt.toISOString().slice(0, 10)}`);
  console.log(
    user.passwordHash
      ? "It has a password set, so sign-in should work. If it does not, the"
      : "It has NO password set. This happens on a Google-only account:"
  );
  console.log(
    user.passwordHash
      ? "password itself is wrong rather than anything being broken."
      : "sign in with Google, or use the reset flow to set a password."
  );
} finally {
  await prisma.$disconnect();
}
