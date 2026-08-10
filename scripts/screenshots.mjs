/**
 * Captures the marketing screenshots from the running app.
 *
 * Marketing images go stale quietly: the app changes, the picture on the front
 * page does not, and nobody notices because nothing breaks. Re-running this
 * takes a minute, so the pictures can be refreshed whenever a screen changes
 * rather than being a small project each time.
 *
 * Every shot is taken at the same viewport and pixel density, so they sit
 * together on the page without one looking softer or larger than the rest.
 *
 *   FREELY_EMAIL=you@example.com FREELY_PASSWORD=secret npm run screenshots
 *
 * It photographs the newest quote and the newest project. To choose a
 * different one, pass --quote /quote/<id> or --project /track/<id>.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Loaded on demand rather than listed as a devDependency: the playwright
// package downloads a browser when it installs, and Vercel installs
// devDependencies on every build. This is a tool run by hand a few times a
// year, so it should not sit in the deploy path.
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "\nThis needs Playwright, which is not installed:\n" +
      "  npm i -D playwright && npx playwright install chromium\n" +
      "Uninstall it afterwards if you would rather not keep it around.\n",
  );
  process.exit(1);
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.FREELY_EMAIL;
const PASSWORD = process.env.FREELY_PASSWORD;

// 2x on a laptop-width viewport. The height is deliberately shorter than the
// window: a marketing image wants a wide crop of the top of the screen, not a
// tall shot with the fold in the middle of it.
const VIEWPORT = { width: 1440, height: 760 };
const SCALE = 2;

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!EMAIL || !PASSWORD) {
  fail(
    "Set FREELY_EMAIL and FREELY_PASSWORD to an account with a quote and a project in it.\n" +
      "Use a test account: this signs in and takes pictures of whatever is on the screen.",
  );
}

const outputDir = join(process.cwd(), "public");
mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  // Screenshots are for the English page. The switcher writes this cookie, so
  // setting it here avoids capturing Spanish from a Spanish laptop.
  locale: "en-GB",
});
await context.addCookies([
  { name: "locale", value: "en", url: BASE },
]);
const page = await context.newPage();

try {
  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"), { timeout: 30_000 });
} catch {
  fail("Could not sign in. Check the email and password, and that the app is running at " + BASE);
}

/**
 * Picks the newest quote and project unless told otherwise.
 *
 * Asking for two ids meant copying them out of the address bar before every
 * run, which is the sort of small friction that stops the pictures being
 * refreshed. Pass --quote or --project to override.
 */
async function findFirst(listPath, selector, attribute) {
  await page.goto(`${BASE}${listPath}`, { waitUntil: "networkidle" });
  const element = page.locator(selector).first();
  if ((await element.count()) === 0) return null;
  return attribute === "href"
    ? await element.getAttribute("href")
    : `/track/${await element.getAttribute(attribute)}`;
}

const quotePath =
  arg("quote") ?? (await findFirst("/quote/all", 'a[href^="/quote/"]', "href"));
const projectPath =
  arg("project") ?? (await findFirst("/track", "[data-project]", "data-project"));

if (!quotePath) {
  fail("No quotes found on /quote/all. Make one first, or pass --quote /quote/<id>.");
}
if (!projectPath) {
  fail("No projects found on /track. Send a quote to Track first, or pass --project /track/<id>.");
}

const shots = [
  { file: "marketing-hero.png", path: "/quote", label: "the quote wizard" },
  { file: "marketing-quote.png", path: quotePath, label: "a finished quote" },
  { file: "marketing-track.png", path: "/track", label: "the Track dashboard" },
  { file: "marketing-project.png", path: projectPath, label: "one project" },
];

for (const shot of shots) {
  const url = shot.path.startsWith("http") ? shot.path : `${BASE}${shot.path}`;
  await page.goto(url, { waitUntil: "networkidle" });

  if (page.url().includes("/signin")) {
    fail(`Signed out when opening ${shot.path}. The account may not have access to it.`);
  }

  // Let fonts settle and any entry animation finish, so text is not captured
  // mid-fade.
  await page.waitForTimeout(600);

  const file = join(outputDir, shot.file);
  await page.screenshot({ path: file });
  console.log(`${shot.file.padEnd(24)} ${shot.label}`);
}

await browser.close();
console.log(`\nSaved to public/. Look at them before committing: this captures whatever was
on the screen, including any client name in the account you used.`);
