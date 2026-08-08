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
import { currencySymbol } from "@/lib/currencies";

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    .toUpperCase();
}

function money(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function renderInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
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

  const subtotal = invoice.lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = invoice.taxRate > 0 ? (subtotal * invoice.taxRate) / 100 : 0;
  const total = subtotal + tax;

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <Text style={styles.eyebrow}>{invoice.fromRole || " "}</Text>
          <Text style={styles.invoiceWord}>Invoice</Text>
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
            <Text style={styles.metaLine}>Issued {formatDate(invoice.issuedAt)}</Text>
            <Text style={styles.metaLine}>Due {formatDate(invoice.dueAt)}</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>From</Text>
            <Text style={styles.partyName}>{invoice.fromName}</Text>
            {invoice.fromWebsite ? <Text style={styles.partyLine}>{invoice.fromWebsite}</Text> : null}
            {invoice.fromAddress ? <Text style={styles.partyLine}>{invoice.fromAddress}</Text> : null}
            {invoice.fromEmail ? <Text style={styles.partyLine}>{invoice.fromEmail}</Text> : null}
          </View>
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>Billed to</Text>
            <Text style={styles.partyName}>{invoice.clientName}</Text>
            {invoice.clientCompany ? <Text style={styles.partyLine}>{invoice.clientCompany}</Text> : null}
            {invoice.clientWebsite ? <Text style={styles.partyLine}>{invoice.clientWebsite}</Text> : null}
            {invoice.clientEmail ? <Text style={styles.partyLine}>{invoice.clientEmail}</Text> : null}
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={styles.thDesc}>Description</Text>
          <Text style={styles.thNum}>Rate</Text>
          <Text style={styles.thNum}>Hrs</Text>
          <Text style={styles.thAmount}>Amount</Text>
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
            <Text style={styles.cellNum}>
              {item.rate ? `${currencySymbol(invoice.currency)}${item.rate}/hr` : "-"}
            </Text>
            <Text style={styles.cellNum}>{item.hours ? item.hours : "-"}</Text>
            <Text style={styles.cellAmount}>{money(item.amount, invoice.currency)}</Text>
          </View>
        ))}

        <View style={styles.totalsWrap}>
          <View style={styles.totalsRule} />
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{money(subtotal, invoice.currency)}</Text>
          </View>
          {invoice.taxRate > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax ({invoice.taxRate}%)</Text>
              <Text style={styles.totalsValue}>{money(tax, invoice.currency)}</Text>
            </View>
          )}
          <View style={styles.totalsRule} />
          <View style={styles.totalsRow}>
            <Text style={styles.dueLabel}>Total due</Text>
            <Text style={styles.dueValue}>{money(total, invoice.currency)}</Text>
          </View>
        </View>

        <View style={styles.payRow}>
          <View style={styles.payBox}>
            <Text style={styles.payLabel}>Payment details</Text>
            <Text style={styles.payText}>{invoice.payment.block}</Text>
            {invoice.payment.note ? <Text style={styles.payNote}>{invoice.payment.note}</Text> : null}
          </View>
          <View style={{ flex: 1, paddingTop: S4 }}>
            {invoice.reference ? (
              <>
                <Text style={styles.payLabel}>Reference</Text>
                <Text style={styles.payText}>{invoice.reference}</Text>
              </>
            ) : null}
            <View style={{ marginTop: S4 }}>
              <View style={styles.dueBadge}>
                <Text style={styles.dueBadgeText}>Due {formatShortDate(invoice.dueAt)}</Text>
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
