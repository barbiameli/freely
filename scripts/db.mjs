/**
 * Run a database command against a named environment, and say which one.
 *
 * This exists because of a bug it now prevents. There are two databases: .env
 * points at a local Postgres, .env.production.local at Neon, which is what the
 * deployed site uses. Prisma reads .env and only .env, so every `prisma db
 * push` went to the local one, and the live database silently never got the new
 * columns. The deployed code then asked Neon for a column that was not there,
 * which surfaced as "check your email and password" on the sign-in form,
 * because that is what a thrown query looks like from inside authorize().
 *
 * A diagnostic script written the same way reported the account was fine. It
 * was fine, in the wrong database.
 *
 * So: the environment is always named on the command line, never defaulted, and
 * the host is always printed before anything runs. Being explicit about which
 * database you are about to change is worth two extra words.
 *
 *   node scripts/db.mjs local push
 *   node scripts/db.mjs production push
 *   node scripts/db.mjs production check you@example.com
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ENV_FILES = {
  local: ".env",
  production: ".env.production.local",
};

const [target, command, ...rest] = process.argv.slice(2);

if (!ENV_FILES[target] || !command) {
  console.error("Usage:");
  console.error("  node scripts/db.mjs <local|production> push");
  console.error("  node scripts/db.mjs <local|production> check <email>");
  process.exit(1);
}

const file = ENV_FILES[target];
let contents;
try {
  contents = readFileSync(file, "utf8");
} catch {
  console.error(`Cannot read ${file}. Nothing has been changed.`);
  process.exit(1);
}

/** Parses the KEY="value" lines, ignoring comments and blanks. */
function parse(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const vars = parse(contents);
const url = vars.DATABASE_URL;
if (!url) {
  console.error(`${file} has no DATABASE_URL. Nothing has been changed.`);
  process.exit(1);
}

// The host, never the credentials. Printed before the command runs so there is
// a chance to stop.
let host = "unparseable";
try {
  host = new URL(url).hostname;
} catch {
  /* fall through with the placeholder */
}
console.log(`Target: ${target}  (${file})`);
console.log(`Host:   ${host}`);
console.log("");

const env = { ...process.env, DATABASE_URL: url };

if (command === "push") {
  const result = spawnSync("npx", ["prisma", "db", "push"], { stdio: "inherit", env });
  process.exit(result.status ?? 1);
}

if (command === "check") {
  const email = rest[0];
  if (!email) {
    console.error("Which email? node scripts/db.mjs production check you@example.com");
    process.exit(1);
  }
  const result = spawnSync("node", ["scripts/check-account.mjs", email], {
    stdio: "inherit",
    env,
  });
  process.exit(result.status ?? 1);
}

console.error(`Unknown command "${command}". Use push or check.`);
process.exit(1);
