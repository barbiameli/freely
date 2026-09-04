export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

/** A short, common list — not exhaustive ISO 4217, just what freelancers
 * quoting international clients actually need. */
export const CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "AU$", name: "Australian Dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "SEK", symbol: "kr", name: "Swedish Krona" },
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/** The currency symbol to prefix a price with — falls back to the code
 * itself (e.g. "XYZ 100") if it's not in the known list, and to "$" if
 * nothing was passed at all (keeps old data/callers working). */
export function currencySymbol(code?: string | null): string {
  if (!code) return "$";
  return BY_CODE.get(code)?.symbol ?? `${code} `;
}

export function currencyName(code?: string | null): string {
  if (!code) return "US Dollar";
  return BY_CODE.get(code)?.name ?? code;
}

/*
 * formatMoney used to live here and now lives in lib/money.
 *
 * It was re-exported from this file so the old import path kept working, and
 * that one line was an import cycle: lib/money imports currencySymbol from
 * here, and this file pulled lib/money back in. Nothing imports formatMoney
 * through this path any more, so the line is gone.
 *
 * The cycle was harmless until the module graph changed shape around it, and
 * then it crashed the quote page in production with "Cannot access 'D' before
 * initialization", D being the minified BY_CODE map above: the bundler
 * suspended this module halfway through to evaluate lib/money, and a
 * currencySymbol call in a useState initialiser reached BY_CODE while it was
 * still in the temporal dead zone. Nothing catches this. TypeScript is happy,
 * every test passes, the build succeeds, and it only fails in a browser
 * against a production bundle.
 *
 * So: a compatibility re-export is never worth an import cycle. Change the
 * callers instead. tests/import-cycles.test.ts now fails on any new one.
 */
