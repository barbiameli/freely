import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatMoney, invoiceTotals, localeTag } from "@/lib/money";
import { parseLocale } from "@/lib/i18n";
import { dict } from "@/lib/i18n";

/**
 * Invoice PDF.
 *
 * Layout follows the one Barbara already uses: an eyebrow and "INVOICE" on the
 * top row, the sender's name large with a disciplines line under it, the
 * number and dates ranged right, FROM and BILLED TO side by side, a
 * description/rate/hours/amount table, totals ranged right, then a payment
 * details block beside a reference column, and a closing note.
 *
 * Colours and logo come from whatever branding the matching quote used, so an
 * invoice doesn't arrive looking like it came from a different company.
 *
 * Payment details are passed in per render and are never persisted. See the
 * Invoice model, which deliberately has no columns for them.
 */
export interface InvoiceLineItem {
  title: string;
  description?: string;
  rate?: number | null;
  hours?: number | null;
  amount: number;
}

/** Typed fresh for every render, never stored. Free text on purpose: the
 * shape of payment details varies by country and by bank, and a rigid set of
 * fields would be wrong for most people. */
export interface InvoicePaymentDetails {
  /** Free text, printed as typed. What a client needs in order to pay differs
   * by country (IBAN and BIC, sort code and account number, routing number,
   * CLABE), so this is deliberately not a set of structured fields. */
  block: string;
  /** An optional trailing line, e.g. "full details on request". */
  note?: string;
}

export interface InvoicePdfData {
  /** Deliverables with hours, or one line and a total. */
  itemised?: boolean;
  number: number;
  issuedAt: string;
  dueAt: string;
  reference: string;
  clientName: string;
  clientCompany: string;
  clientWebsite: string;
  clientEmail: string;
  fromName: string;
  fromTagline: string;
  /** Optional top-left line, e.g. "UX designer & product thinker". */
  fromRole?: string;
  fromWebsite: string;
  fromEmail: string;
  fromAddress: string;
  lineItems: InvoiceLineItem[];
  currency: string;
  taxRate: number;
  notes: string;
  payment: InvoicePaymentDetails;
  /** Resolved from the quote's branding choice. */
  primary: string;
  accent: string;
  logoDataUrl?: string | null;
  mono?: boolean;
  dark?: boolean;
  /**
   * The language of the quote this invoice came from.
   *
   * Same fix as the quote PDF: every column heading here was an English
   * literal, so a Spanish project produced an invoice headed "Description",
   * "Amount" and "Total due".
   */
  language?: string | null;
}

Font.registerHyphenationCallback((word) => [word]);

const S1 = 4;
const S2 = 8;
const S3 = 12;
const S4 = 16;
const S5 = 24;
const S6 = 32;
const S7 = 44;

const BOLD = "Helvetica-Bold";

/**
 * Issued and due are days, not instants.
 *
 * UTC is stated rather than assumed. These read correctly today because Vercel
 * happens to run in UTC, which is luck rather than a decision, and the same
 * dates rendered in a browser were already coming out a day early west of it.
 */
function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatShortDate(iso: string, locale: string): string {
  return new Date(iso)
    .toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

/**
 * Deleted, and replaced by lib/money.
 *
 * It called toLocaleString with no locale, which on a server is the server's
 * locale rather than the reader's, so a Spanish invoice printed its dates in
 * Spanish and its numbers in English. It also forced two decimal places onto
 * every currency, including the yen, which has none.
 */

export async function renderInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
  const w = dict(invoice.language).invoicePdf;
  // One place decides which language this document is in, and both the
  // dates and the numbers read it. They used to disagree.
  const language = parseLocale(invoice.language ?? "en");
  const locale = localeTag(language);
  const ink = invoice.dark ? "#FFFFFF" : "#111111";
  const bg = invoice.dark ? "#0B0B0C" : "#FFFFFF";
  const muted = invoice.dark ? "#9A9AA0" : "#8A8990";
  // Solid hex, not rgba: react-pdf renders rgba border colours unpredictably.
  const line = invoice.dark ? "#2E2E31" : "#E8EAEF";
  const tint = invoice.dark ? "#17171A" : "#F8F9FA";
  // In mono the accent must not introduce colour, since the whole point of
  // that preset is a document with none.
  const accent = invoice.mono ? ink : invoice.accent;

  const styles = StyleSheet.create({
    page: {
      paddingTop: S7,
      paddingHorizontal: S7 + S2,
      paddingBottom: S7,
      backgroundColor: bg,
      color: ink,
      fontFamily: "Helvetica",
      fontSize: 9.5,
    },
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    eyebrow: { fontSize: 7.5, letterSpacing: 1.2, textTransform: "uppercase", color: muted },
    invoiceWord: { fontSize: 7.5, letterSpacing: 1.2, textTransform: "uppercase", color: ink, fontFamily: BOLD },

    identityRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: S5,
    },
    senderName: { fontSize: 20, fontFamily: BOLD, color: ink, letterSpacing: 0.5 },
    senderTagline: { fontSize: 7.5, letterSpacing: 1, textTransform: "uppercase", color: muted, marginTop: S1 + 1 },
    logo: { height: 26, objectFit: "contain" },
    metaBlock: { alignItems: "flex-end" },
    metaNumber: { fontSize: 13, fontFamily: BOLD, color: ink },
    metaLine: { fontSize: 8.5, color: muted, marginTop: 3 },

    partiesRow: { flexDirection: "row", marginTop: S7, gap: S7 },
    partyCol: { flex: 1 },
    partyLabel: { fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase", color: muted, marginBottom: S2 + 2 },
    partyName: { fontSize: 10, fontFamily: BOLD, color: ink, marginBottom: 2 },
    partyLine: { fontSize: 9, color: muted, marginTop: 1.5 },

    tableHead: {
      flexDirection: "row",
      marginTop: S7,
      paddingBottom: S2,
      borderBottomWidth: 1,
      borderBottomColor: line,
    },
    thDesc: { flex: 1, fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase", color: muted },
    thNum: { width: 58, textAlign: "right", fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase", color: muted },
    thAmount: { width: 72, textAlign: "right", fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase", color: muted },

    row: { flexDirection: "row", paddingTop: S4, paddingBottom: S3 },
    itemTitle: { fontSize: 10, fontFamily: BOLD, color: ink },
    itemDesc: { fontSize: 8.5, color: muted, marginTop: S1, lineHeight: 1.5 },
    cellNum: { width: 58, textAlign: "right", fontSize: 9.5, color: ink },
    cellAmount: { width: 72, textAlign: "right", fontSize: 9.5, color: ink, fontFamily: BOLD },

    totalsWrap: { alignItems: "flex-end", marginTop: S5 },
    totalsRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", width: 260, paddingVertical: S2 },
    totalsLabel: { flex: 1, textAlign: "right", fontSize: 9, color: muted, paddingRight: S5 },
    totalsValue: { width: 90, textAlign: "right", fontSize: 9.5, color: ink },
    dueLabel: { flex: 1, textAlign: "right", fontSize: 8, letterSpacing: 1.2, textTransform: "uppercase", color: ink, fontFamily: BOLD, paddingRight: S5 },
    dueValue: { width: 90, textAlign: "right", fontSize: 15, color: accent, fontFamily: BOLD },
    totalsRule: { borderTopWidth: 1, borderTopColor: line, width: 260, marginTop: S1 },

    payRow: { flexDirection: "row", marginTop: S6, gap: S5, alignItems: "flex-start" },
    payBox: { flex: 1, backgroundColor: tint, borderRadius: 6, padding: S4 },
    payLabel: { fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase", color: muted, marginBottom: S2 },
    payText: { fontSize: 9, color: ink, lineHeight: 1.6 },
    payNote: { fontSize: 8.5, color: muted, marginTop: S2 },
    dueBadge: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: accent,
      borderRadius: 999,
      paddingHorizontal: S3,
      paddingVertical: 5,
    },
    dueBadgeText: { fontSize: 7.5, letterSpacing: 1, textTransform: "uppercase", color: accent, fontFamily: BOLD },

    footer: {
      position: "absolute",
      bottom: S5,
      left: S7 + S2,
      right: S7 + S2,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      borderTopWidth: 1,
      borderTopColor: line,
      paddingTop: S3,
    },
    footerNote: { fontSize: 8.5, color: muted, lineHeight: 1.5, maxWidth: "70%" },
    footerSite: { fontSize: 8.5, color: muted },
  });

  // Defaults to itemised: an older invoice with no flag stored was written
  // when every invoice showed the breakdown, so that is what it showed.
  const itemised = invoice.itemised !== false;
  // Rounded before they are summed, so the printed lines add up to the
  // printed total. An invoice is added up by the person paying it.
  const { subtotal, tax, total } = invoiceTotals(
    invoice.lineItems.map((item) => item.amount),
    invoice.taxRate,
    invoice.currency
  );
  const money = (amount: number) => formatMoney(amount, invoice.currency, language);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <Text style={styles.eyebrow}>{invoice.fromRole || " "}</Text>
          <Text style={styles.invoiceWord}>{w.invoice}</Text>
        </View>

        <View style={styles.identityRow}>
          <View>
            {invoice.logoDataUrl ? (
              <Image src={invoice.logoDataUrl} style={styles.logo} />
            ) : (
              <Text style={styles.senderName}>{invoice.fromName.toUpperCase()}</Text>
            )}
            {invoice.fromTagline ? <Text style={styles.senderTagline}>{invoice.fromTagline}</Text> : null}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaNumber}>#{String(invoice.number).padStart(4, "0")}</Text>
            <Text style={styles.metaLine}>{w.issued} {formatDate(invoice.issuedAt, locale)}</Text>
            <Text style={styles.metaLine}>{w.due} {formatDate(invoice.dueAt, locale)}</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>{w.from}</Text>
            <Text style={styles.partyName}>{invoice.fromName}</Text>
            {invoice.fromWebsite ? <Text style={styles.partyLine}>{invoice.fromWebsite}</Text> : null}
            {invoice.fromAddress ? <Text style={styles.partyLine}>{invoice.fromAddress}</Text> : null}
            {invoice.fromEmail ? <Text style={styles.partyLine}>{invoice.fromEmail}</Text> : null}
          </View>
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>{w.billedTo}</Text>
            <Text style={styles.partyName}>{invoice.clientName}</Text>
            {invoice.clientCompany ? <Text style={styles.partyLine}>{invoice.clientCompany}</Text> : null}
            {invoice.clientWebsite ? <Text style={styles.partyLine}>{invoice.clientWebsite}</Text> : null}
            {invoice.clientEmail ? <Text style={styles.partyLine}>{invoice.clientEmail}</Text> : null}
          </View>
        </View>

        {/* Summary invoices drop the rate and hours columns rather than
            filling them with dashes: a client being billed one figure for a
            finished project does not need two empty columns explaining that
            the breakdown was withheld. */}
        <View style={styles.tableHead}>
          <Text style={styles.thDesc}>{w.description}</Text>
          {itemised ? <Text style={styles.thNum}>{w.rate}</Text> : null}
          {itemised ? <Text style={styles.thNum}>{w.units}</Text> : null}
          <Text style={styles.thAmount}>{w.amount}</Text>
        </View>

        {invoice.lineItems.map((item, i) => (
          <View
            key={i}
            style={[
              styles.row,
              i < invoice.lineItems.length - 1
                ? { borderBottomWidth: 1, borderBottomColor: line }
                : {},
            ]}
            minPresenceAhead={64}
          >
            <View style={{ flex: 1, paddingRight: S4 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
            </View>
            {itemised ? (
              <Text style={styles.cellNum}>
                {item.rate ? `${money(item.rate)}/hr` : "-"}
              </Text>
            ) : null}
            {itemised ? <Text style={styles.cellNum}>{item.hours ? item.hours : "-"}</Text> : null}
            <Text style={styles.cellAmount}>{money(item.amount)}</Text>
          </View>
        ))}

        <View style={styles.totalsWrap}>
          <View style={styles.totalsRule} />
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{w.subtotal}</Text>
            <Text style={styles.totalsValue}>{money(subtotal)}</Text>
          </View>
          {invoice.taxRate > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>{w.tax} ({invoice.taxRate}%)</Text>
              <Text style={styles.totalsValue}>{money(tax)}</Text>
            </View>
          )}
          <View style={styles.totalsRule} />
          <View style={styles.totalsRow}>
            <Text style={styles.dueLabel}>{w.totalDue}</Text>
            <Text style={styles.dueValue}>{money(total)}</Text>
          </View>
        </View>

        <View style={styles.payRow}>
          <View style={styles.payBox}>
            <Text style={styles.payLabel}>{w.paymentDetails}</Text>
            <Text style={styles.payText}>{invoice.payment.block}</Text>
            {invoice.payment.note ? <Text style={styles.payNote}>{invoice.payment.note}</Text> : null}
          </View>
          <View style={{ flex: 1, paddingTop: S4 }}>
            {invoice.reference ? (
              <>
                <Text style={styles.payLabel}>{w.reference}</Text>
                <Text style={styles.payText}>{invoice.reference}</Text>
              </>
            ) : null}
            <View style={{ marginTop: S4 }}>
              <View style={styles.dueBadge}>
                <Text style={styles.dueBadgeText}>{w.due} {formatShortDate(invoice.dueAt, locale)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerNote}>{invoice.notes}</Text>
          <Text style={styles.footerSite}>{invoice.fromWebsite}</Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
