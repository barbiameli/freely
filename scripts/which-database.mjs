/**
 * Which database is this, without printing the password.
 *
 * check-account.mjs proved the account exists. It proved it in the database
 * that .env points at, which is not necessarily the one the deployed site
 * talks to: Vercel environment variables are per project, and this project has
 * had two. An account that exists locally and not in production fails sign-in
 * with exactly the message a wrong password gives.
 *
 * So this prints the parts that identify a database and none of the parts that
 * unlock it: host, database name, and a short fingerprint of the whole URL.
 * Compare the fingerprint against the same script run with Vercel's value, or
 * just compare the host by eye in the Vercel dashboard. The password never
 * appears, here or in a terminal history.
 *
 *   node scripts/which-database.mjs
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

function readEnvValue(name) {
  // Read .env directly rather than importing dotenv: this script has to work
  // before anything else does.
  let text;
  try {
    text = readFileSync(".env", "utf8");
  } catch {
    return process.env[name];
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() !== name) continue;
    return trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return process.env[name];
}

const url = readEnvValue("DATABASE_URL");
if (!url) {
  console.error("No DATABASE_URL found in .env or the environment.");
  process.exit(1);
}

try {
  const parsed = new URL(url);
  // A short hash of the whole string, so two of these can be compared for
  // "same database?" without either being readable.
  const fingerprint = createHash("sha256").update(url).digest("hex").slice(0, 12);

  console.log("Host:        " + parsed.hostname);
  console.log("Database:    " + parsed.pathname.replace(/^\//, ""));
  console.log("User:        " + parsed.username);
  console.log("Fingerprint: " + fingerprint);
  console.log("");
  console.log("In Vercel: Settings, then Environment Variables, then DATABASE_URL.");
  console.log("If the host there is different from the one above, the live site is");
  console.log("talking to a different database, and your account is only in this one.");
} catch {
  console.error("DATABASE_URL is not a URL that can be parsed.");
  process.exit(1);
}
