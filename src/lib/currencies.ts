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

/**
 * Moved to lib/money.
 *
 * This asked for no fraction digits, so 1234.5 rendered as "£1,234.5", and it
 * passed no locale, so it followed whichever machine happened to run it.
 * Re-exported here so the old import path keeps working, with the language
 * defaulting to English as it effectively did before.
 */
export { formatMoney } from "@/lib/money";
