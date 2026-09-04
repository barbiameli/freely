/**
 * Money, written the way the reader writes it.
 *
 * Three things were wrong, all in the same place and all in the document a
 * client receives.
 *
 * The invoice PDF localised its dates and not its numbers, so a Spanish
 * invoice printed "26 de agosto de 2026" beside "1,234.50". Half the document
 * in one convention and half in the other, which reads as a mistake because it
 * is one. The number was going through toLocaleString with no locale at all,
 * which on a server means the server's locale rather than the reader's.
 *
 * Yen was printing with two decimal places. The yen has no minor unit, so
 * "¥1,234.50" is not a smaller amount of money, it is not an amount of money.
 *
 * And the on-screen formatter asked for no fraction digits at all, so a price
 * of 1234.5 appeared as "£1,234.5", which looks like a bug because it looks
 * like a bug.
 *
 * One function now, used by the screen and by the PDF, so the two cannot drift
 * apart again.
 */
import { currencySymbol } from "@/lib/currencies";
import type { Locale } from "@/lib/i18n/types";

/**
 * How many decimal places a currency actually has.
 *
 * Two unless stated. Only the currencies Freely offers are listed, since a
 * table of every ISO 4217 minor unit would be a lot of lines in service of
 * currencies nobody can pick.
 */
const MINOR_UNITS: Record<string, number> = {
  JPY: 0,
};

export function minorUnits(currency?: string | null): number {
  if (!currency) return 2;
  return MINOR_UNITS[currency] ?? 2;
}

/**
 * The BCP 47 tag for one of Freely's languages.
 *
 * en-GB rather than en-US: the app is written in British English, and the
 * difference that matters here is the date order rather than the number, which
 * the two share.
 */
export function localeTag(language?: Locale | null): string {
  return language === "es" ? "es-ES" : "en-GB";
}

/**
 * The number alone, grouped and rounded for the reader.
 *
 * Separate from the symbol because the PDF right-aligns a column of these and
 * wants to place the symbol itself.
 */
export function formatAmount(
  amount: number,
  currency?: string | null,
  language?: Locale | null
): string {
  const places = minorUnits(currency);
  return amount.toLocaleString(localeTag(language), {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
}

/**
 * A price, symbol and all.
 *
 * The symbol stays in front even in Spanish, where the convention is to put it
 * after. That is a deliberate limit: the numbers being in the wrong format is
 * a mistake a reader notices, and a symbol on the wrong side is a convention
 * they will read past. Moving it would also reflow the invoice's totals
 * column, which is a layout change rather than a correctness one.
 */
export function formatMoney(
  amount: number,
  currency?: string | null,
  language?: Locale | null
): string {
  return `${currencySymbol(currency)}${formatAmount(amount, currency, language)}`;
}

/**
 * A total that agrees with the lines above it.
 *
 * An invoice is added up by the person paying it. If each line is rounded for
 * display but the total is computed from the unrounded values, the printed
 * numbers can fail to add up by a penny, and a client who checks finds an
 * invoice that is wrong in a way nobody can explain.
 *
 * So the rounding happens first, at the precision the currency is printed to,
 * and the total is the sum of what the reader can actually see.
 */
export function roundTo(amount: number, currency?: string | null): number {
  const factor = 10 ** minorUnits(currency);
  return Math.round(amount * factor) / factor;
}

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * Subtotal, tax and total, each already rounded to what will be printed.
 *
 * Line amounts are rounded before they are summed, so the subtotal is the sum
 * of the printed line amounts rather than of the values behind them.
 */
export function invoiceTotals(
  lineAmounts: number[],
  taxRatePercent: number,
  currency?: string | null
): InvoiceTotals {
  const subtotal = roundTo(
    lineAmounts.reduce((sum, amount) => sum + roundTo(amount, currency), 0),
    currency
  );
  const tax = taxRatePercent > 0 ? roundTo((subtotal * taxRatePercent) / 100, currency) : 0;
  return { subtotal, tax, total: roundTo(subtotal + tax, currency) };
}

/**
 * A total that is only shown when there is one currency to show it in.
 *
 * Home summed every invoice and labelled the result with the first row's
 * currency, so a freelancer with one client in dollars and one in euros saw a
 * number that was neither, presented as fact. Adding across currencies is not
 * a rounding problem, it is a wrong answer with a confident face.
 *
 * Returns the dominant currency and how many rows were left out, so the page
 * can say "and 2 more in other currencies" rather than quietly folding them in.
 */
export function totalInOneCurrency(
  rows: { amount: number; currency?: string | null }[]
): { total: number; currency: string | null; otherCurrencies: number } {
  if (rows.length === 0) return { total: 0, currency: null, otherCurrencies: 0 };

  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.currency ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // The one most rows are in. Ties go to the first seen, which is the most
  // recent row, and that is as good an answer as any.
  const dominant = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];

  const matching = rows.filter((row) => (row.currency ?? "") === dominant);
  return {
    total: matching.reduce((sum, row) => sum + row.amount, 0),
    currency: dominant || null,
    otherCurrencies: rows.length - matching.length,
  };
}
