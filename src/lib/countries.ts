/**
 * Where somebody is based, and what that implies about money.
 *
 * A rate is a local number. The same senior product designer is worth a
 * different amount in Copenhagen and in Bogota, and any research that does not
 * know which one it is looking at is producing an average of the world.
 *
 * Until now nothing here was asked. Currency defaulted to USD and only appeared
 * on the screen if somebody said they already knew their rate, which is the one
 * case where a researched rate is not needed. Anybody who said they were not
 * sure what to charge got a rate researched in dollars, silently, wherever they
 * lived.
 *
 * So a country is asked once, and everything else is derived from it. A country
 * is the right grain: a city is more precise but there are thousands of them
 * and no cache can hold that, while a continent is too coarse to move a number.
 *
 * The list is not every country. It is the places freelancers quoting in
 * English and Spanish actually work from, and it is easy to extend. Somewhere
 * missing is a real gap and should be added rather than worked around.
 */

export interface Country {
  /** ISO 3166-1 alpha-2, because it is stable and short. */
  code: string;
  name: string;
  /** ISO 4217, and the default for anybody based there. */
  currency: string;
}

export const COUNTRIES: Country[] = [
  { code: "AR", name: "Argentina", currency: "USD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "AT", name: "Austria", currency: "EUR" },
  { code: "BE", name: "Belgium", currency: "EUR" },
  { code: "BR", name: "Brazil", currency: "BRL" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "CL", name: "Chile", currency: "USD" },
  { code: "CO", name: "Colombia", currency: "USD" },
  { code: "HR", name: "Croatia", currency: "EUR" },
  { code: "CZ", name: "Czechia", currency: "EUR" },
  { code: "DK", name: "Denmark", currency: "EUR" },
  { code: "EE", name: "Estonia", currency: "EUR" },
  { code: "FI", name: "Finland", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "GR", name: "Greece", currency: "EUR" },
  { code: "HU", name: "Hungary", currency: "EUR" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "IL", name: "Israel", currency: "USD" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "MX", name: "Mexico", currency: "MXN" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "NZ", name: "New Zealand", currency: "AUD" },
  { code: "NO", name: "Norway", currency: "SEK" },
  { code: "PE", name: "Peru", currency: "USD" },
  { code: "PH", name: "Philippines", currency: "USD" },
  { code: "PL", name: "Poland", currency: "EUR" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "RO", name: "Romania", currency: "EUR" },
  { code: "SG", name: "Singapore", currency: "USD" },
  { code: "ZA", name: "South Africa", currency: "USD" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "SE", name: "Sweden", currency: "SEK" },
  { code: "CH", name: "Switzerland", currency: "CHF" },
  { code: "TH", name: "Thailand", currency: "USD" },
  { code: "TR", name: "Turkey", currency: "USD" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "UY", name: "Uruguay", currency: "USD" },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/**
 * The country's name, for a prompt or a screen.
 *
 * Falls back to the code, so an account saved before a country was removed
 * from the list still reads as something rather than as blank.
 */
export function countryName(code?: string | null): string | null {
  if (!code) return null;
  return BY_CODE.get(code)?.name ?? code;
}

/**
 * What somebody in this country most likely bills in.
 *
 * Two deliberate simplifications. Several countries here map to USD rather
 * than to their own currency, because freelancers in Buenos Aires, Bogota and
 * Manila overwhelmingly invoice international clients in dollars and quoting
 * in pesos would be the surprising answer. And the Nordics share a krona and
 * Central Europe shares the euro, because the currency list is short on
 * purpose and a near-neighbour is closer than a dollar.
 *
 * It is a starting point, not a rule. The currency stays editable everywhere
 * it was editable before.
 */
export function currencyForCountry(code?: string | null): string {
  if (!code) return "USD";
  return BY_CODE.get(code)?.currency ?? "USD";
}

/** Whether a stored value is one this list still recognises. */
export function isKnownCountry(code?: string | null): boolean {
  return Boolean(code && BY_CODE.has(code));
}

/**
 * The country to assume from a currency alone.
 *
 * Only somebody who says they do not know what to charge is asked where they
 * are, because they are the only ones a rate gets researched for. Asking
 * everybody else would be collecting an answer to a question that is never
 * put, and one more screen between a person and their first quote.
 *
 * Which leaves a guess for the rest, and a guess is fine here: it decides a
 * cache bucket, not a price. GBP is Britain and JPY is Japan with no real
 * doubt. The euro and the dollar are the two that are genuinely ambiguous, and
 * both resolve to their largest freelance market, which is the likeliest
 * answer and not a claim to be right.
 */
const COUNTRY_BY_CURRENCY: Record<string, string> = {
  USD: "US",
  EUR: "DE",
  GBP: "GB",
  CAD: "CA",
  AUD: "AU",
  CHF: "CH",
  JPY: "JP",
  INR: "IN",
  BRL: "BR",
  MXN: "MX",
  SEK: "SE",
  AED: "AE",
};

export function countryForCurrency(currency?: string | null): string {
  if (!currency) return "US";
  return COUNTRY_BY_CURRENCY[currency] ?? "US";
}

/**
 * The country to research against: the one they gave, or the one their
 * currency implies.
 *
 * One function so the fallback lives in a single place and every caller gets
 * the same answer. A stored country that has since left the list is not
 * trusted, since the point of the code is to be something the research prompt
 * and the cache key both understand.
 */
export function resolveCountry(stored?: string | null, currency?: string | null): string {
  return isKnownCountry(stored) ? (stored as string) : countryForCurrency(currency);
}
