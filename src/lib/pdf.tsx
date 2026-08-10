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
import type { Style } from "@react-pdf/types";
import { currencySymbol } from "@/lib/currencies";
import { paragraphs, splitDeliverable } from "@/lib/rich-text";
import { describeEffort, rateSuffix, parseRateUnit, unitsFromHours } from "@/lib/rate-unit";
import { parseTimelineStages, isRoadmapWorthy, stageTick } from "@/lib/timeline";
import type { BriefExtras } from "@/lib/anthropic";

export interface StrategyPdfData {
  goal: string;
  findings: string[];
  aiWill: string[];
  aiWillNot: string[];
  openQuestions: string[];
}

export interface BriefExamplePdfData {
  name: string;
  dataUrl: string;
  caption: string;
}

export type PdfTemplate = "classic" | "editorial" | "minimal";

export interface BriefPdfData {
  title: string;
  client: string;
  scope: string;
  /** "HOUR" or "DAY", so the quote reads in whatever it was priced in. */
  rateUnit?: string | null;
  deliverables: string[];
  timeline: string;
  strategy?: StrategyPdfData | null;
  price: number;
  hours: number;
  hourlyRate?: number | null;
  currency?: string | null;
  createdAt: string;
  includeSOW?: boolean;
  includeAI?: boolean;
  brandPrimaryColor?: string | null;
  brandAccentColor?: string | null;
  brandLogoDataUrl?: string | null;
  extras?: BriefExtras | null;
  examples?: BriefExamplePdfData[];
  preparedByEmail?: string | null;
  template?: PdfTemplate;
  /** When true, renders the dedicated brandless Mono layout instead of the
   * chosen `template`, ignoring brandPrimaryColor/brandAccentColor/logo
   * entirely — see lib/branding.ts's "mono-light"/"mono-dark" presets. */
  mono?: boolean;
  /** Only meaningful when mono is true: light vs. dark background. */
  dark?: boolean;
}

Font.registerHyphenationCallback((word) => [word]);

// Freely's own palette — used as the fixed identity color for things like
// the "AI will / AI will not" split, so it never clashes with whatever a
// user has picked as their own brand primary/accent.
const FREELY_VIOLET = "#6320EE";
const FREELY_CORAL = "#F45B69";
const FREELY_INK = "#181722";

// Spacing scale. Every margin and padding below is one of these, so
// vertical rhythm stays consistent instead of drifting between 7, 12, 14,
// 18 and 22 as it did when each block was tuned in isolation.
const S1 = 4;
const S2 = 8;
const S3 = 12;
const S4 = 16;
const S5 = 24;
const S6 = 32;
const S7 = 44;

// Room reserved at the foot of every page for the fixed footer, so body
// content never runs underneath it.
const FOOTER_SPACE = 64;

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingHorizontal: 0,
    // Reserved on every page for the fixed footer.
    paddingBottom: FOOTER_SPACE,
    fontSize: 10.5,
    fontFamily: "Helvetica",
    color: "#343434",
  },
  body: { fontSize: 11, lineHeight: 1.7, color: "#343434" },
  bold: { fontFamily: "Helvetica-Bold" },
  semibold: { fontFamily: "Helvetica-Bold" },

  // Shared "content" padding wrapper — the cover block bleeds full-width,
  // everything else sits inside this. Generous padding/spacing throughout
  // so the page reads as airy rather than dense.
  content: { paddingHorizontal: S7 + S2, paddingTop: S1 },

  logoImg: { height: 20, objectFit: "contain" },
  wordmark: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  wordmarkDark: { fontSize: 12, fontFamily: "Helvetica-Bold", color: FREELY_INK },

  // Classic — dark cover band (logo/wordmark top-left, eyebrow, bold title,
  // client/date line, a 3-up stat row), then labelled section cards below.
  cover: { backgroundColor: FREELY_INK, paddingHorizontal: S7 + S2, paddingTop: S6, paddingBottom: S5, marginBottom: S5 },
  coverEyebrow: { fontSize: 8.5, color: FREELY_CORAL, textTransform: "uppercase", letterSpacing: 1.6, fontFamily: "Helvetica-Bold", marginTop: S5 },
  coverTitle: { fontSize: 22, lineHeight: 1.3, color: "#ffffff", marginTop: S2, fontFamily: "Helvetica-Bold" },
  coverMeta: { fontSize: 9.5, color: "rgba(255,255,255,0.55)", marginTop: S2 },
  coverMetaBold: { fontFamily: "Helvetica-Bold", color: "rgba(255,255,255,0.85)" },
  coverDivider: { borderTopWidth: 1, borderTopColor: "#3A3A3D", marginTop: S5, marginBottom: S4 },
  coverStatRow: { flexDirection: "row" },
  coverStat: { marginRight: S7 },
  coverStatValue: { fontSize: 19, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  coverStatLabel: { fontSize: 7.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.9, marginTop: S1 },

  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: S2 + 2, paddingVertical: 3, marginBottom: S3 },
  pillText: { fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Helvetica-Bold" },

  section: { borderRadius: 8, paddingHorizontal: S5, paddingVertical: S4 + 2, marginBottom: S3 },
  sectionCoral: { backgroundColor: "rgba(244,91,105,0.07)" },
  sectionViolet: { backgroundColor: "rgba(99,32,238,0.06)" },
  sectionPaper: { backgroundColor: "#F8F9FA" },

  bulletRow: { flexDirection: "row", marginBottom: S2 },
  bulletMark: { width: S3, fontSize: 10, color: FREELY_CORAL },
  bulletText: { flex: 1, fontSize: 10.5, lineHeight: 1.7, color: "#343434" },
  subLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: S2, marginTop: S4, fontFamily: "Helvetica-Bold" },
  deliverableRow: { flexDirection: "row", alignItems: "flex-start", fontSize: 11, marginBottom: S2 },
  deliverableMark: { width: S3 + 2, fontSize: 10, color: FREELY_CORAL },
  deliverableText: { flex: 1, fontFamily: "Helvetica-Bold", lineHeight: 1.55 },
  // Same look, without flex: this one sits in a column above its detail, and
  // flex there makes it take its height from the layout rather than the text.
  deliverableLead: { fontSize: 11, fontFamily: "Helvetica-Bold", lineHeight: 1.55 },
  // The description under a deliverable name. Regular weight and a shade
  // lighter: the whole line used to be bold, which is what made a long
  // deliverable read as a slab rather than a heading with detail under it.
  deliverableDetail: { fontSize: 10, lineHeight: 1.65, color: "#565656", marginTop: 4 },

  investmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: S1,
    marginBottom: S3,
    paddingHorizontal: S5,
    paddingVertical: S4 + 2,
    borderRadius: 8,
    backgroundColor: FREELY_INK,
  },
  investmentLabel: { fontSize: 8, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 0.9 },
  investmentMeta: { fontSize: 9.5, color: "rgba(255,255,255,0.85)", marginTop: S1 },
  price: { fontSize: 21, color: "#fff", fontFamily: "Helvetica-Bold" },

  disclosure: { fontSize: 8.5, color: "#8A8990", marginTop: S4, lineHeight: 1.5 },
  exampleBlock: { marginTop: S3 },
  exampleImage: { width: "100%", height: 148, borderRadius: 5, objectFit: "cover" },
  exampleName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginTop: S2 },
  exampleCaption: { fontSize: 9.5, color: "#565656", marginTop: 2, lineHeight: 1.5 },

  // Timeline: a horizontal roadmap (rule, one dot per stage, the timing
  // underneath) with the stages spelled out in full below it.
  timelineWrap: { marginTop: S1 },
  timelineLine: { borderTopWidth: 1.5, marginTop: S2 },
  timelineStages: { flexDirection: "row", marginTop: -4 },
  timelineStage: { flex: 1, alignItems: "center", paddingHorizontal: 3 },
  timelineDot: { width: 7, height: 7, borderRadius: 4, marginBottom: S2 },
  timelineLabel: { fontSize: 7.5, textAlign: "center", lineHeight: 1.35, color: "#565656" },
  timelineDetailList: { marginTop: S5 },
  timelineDetail: { fontSize: 10, lineHeight: 1.65, marginBottom: S2 },

  // Fixed footer, so it sits at the foot of every page instead of floating
  // directly under the content on a short document.
  footer: {
    position: "absolute",
    bottom: S5,
    left: S7 + S2,
    right: S7 + S2,
    borderTopWidth: 1,
    borderTopColor: "#E8EAEF",
    paddingTop: S3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerEmail: { fontSize: 8.5, color: FREELY_CORAL },
  footerMeta: { fontSize: 8.5, color: "#8A8990", textAlign: "right" },

  // Editorial — no cover block, large bold headline, thin colored rule
  // dividers between sections instead of tinted backgrounds.
  edHeader: { paddingHorizontal: 48, paddingTop: 40, paddingBottom: 4 },
  edEyebrow: { fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginTop: 20 },
  edTitle: { fontSize: 32, marginTop: 12, color: FREELY_INK, fontFamily: "Helvetica-Bold" },
  edStatRow: { flexDirection: "row", marginTop: 28, paddingBottom: 24, borderBottomWidth: 1.5 },
  edStat: { marginRight: 44 },
  edStatValue: { fontSize: 22, color: FREELY_INK, fontFamily: "Helvetica-Bold" },
  edStatLabel: { fontSize: 8, color: "#8A8990", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },
  edSection: { paddingVertical: 28, borderBottomWidth: 1, borderBottomColor: "#E8EAEF" },
  edSectionTitle: { fontSize: 16, marginBottom: 12, fontFamily: "Helvetica-Bold" },

  // Minimal — plain, no color blocks, hairline rules, letter-spaced labels.
  minHeader: { paddingHorizontal: 44, paddingTop: 36, paddingBottom: 18, borderBottomWidth: 1.5, borderBottomColor: FREELY_INK },
  minEyebrow: { fontSize: 8.5, textTransform: "uppercase", letterSpacing: 2, color: "#8A8990", marginTop: 18 },
  minTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 8, color: FREELY_INK },
  minMeta: { fontSize: 9.5, color: "#8A8990", marginTop: 4 },
  minStatRow: { flexDirection: "row", marginTop: 14 },
  minStat: { fontSize: 10.5, marginRight: 22, fontFamily: "Helvetica-Bold" },
  minSection: { paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: "#E8EAEF" },
  minLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
});

/** Draws the roadmap graphic and then spells the stages out underneath.
 * Both, deliberately: the graphic shows the shape of the project at a
 * glance, the lines below carry the detail a client needs in order to agree
 * to it. Parsing is shared with the web renderers via lib/timeline so the
 * PDF and the public page can't disagree about the stages. */
function TimelineVisual({
  timeline,
  dotColor,
  textColor,
  mutedColor,
}: {
  timeline: string;
  dotColor: string;
  textColor?: string;
  mutedColor?: string;
}) {
  const stages = parseTimelineStages(timeline);
  const ink = textColor || "#343434";
  const muted = mutedColor || "#565656";

  if (!isRoadmapWorthy(stages)) {
    return <Text style={[styles.body, { color: ink }]}>{timeline}</Text>;
  }

  return (
    <View style={styles.timelineWrap}>
      <View style={[styles.timelineLine, { borderTopColor: dotColor }]} />
      <View style={styles.timelineStages}>
        {stages.map((s, i) => (
          <View key={i} style={styles.timelineStage}>
            <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.timelineLabel, { color: muted }]}>{stageTick(s)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.timelineDetailList}>
        {stages.map((s, i) => (
          <Text key={i} style={[styles.timelineDetail, { color: ink }]}>
            <Text style={styles.bold}>
              {s.period ? `${s.period}: ` : ""}
              {s.label}
            </Text>
            {s.detail ? ` ${s.detail}` : ""}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bulletMark}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

function Pill({ text, tint, color }: { text: string; tint: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: tint }]}>
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

/** Top-left logo/wordmark — shows the user's own branding if they've set a
 * logo (Memory → Branding), otherwise falls back to a plain wordmark. */
function BrandMark({ brief, dark }: { brief: BriefPdfData; dark?: boolean }) {
  if (brief.brandLogoDataUrl) {
    return <Image src={brief.brandLogoDataUrl} style={styles.logoImg} />;
  }
  return <Text style={dark ? styles.wordmarkDark : styles.wordmark}>Freely</Text>;
}

/** Pinned to the bottom of every page (`fixed`), with a page count. The logo
 * used to be repeated down here as well as in the header, which just made the
 * end of the document look cluttered, so it's the contact line and the page
 * number now. */
/** Spelled-out date. "8/8/2026" is ambiguous internationally, and this
 * document goes to clients. */
function formatQuoteDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Footer({
  brief,
  emailColor,
  metaColor,
  ruleColor,
}: {
  brief: BriefPdfData;
  emailColor?: string;
  metaColor?: string;
  ruleColor?: string;
}) {
  return (
    <View
      style={[styles.footer, ruleColor ? { borderTopColor: ruleColor } : {}]}
      fixed
    >
      {brief.preparedByEmail ? (
        <Text style={[styles.footerEmail, emailColor ? { color: emailColor } : {}]}>
          {brief.preparedByEmail}
        </Text>
      ) : (
        <Text />
      )}
      <Text
        style={[styles.footerMeta, metaColor ? { color: metaColor } : {}]}
        render={({ pageNumber, totalPages }) =>
          `${new Date(brief.createdAt).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}  ·  ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

/** The optional add-on sections. Deliberately plain: they're reference
 * material a client reads once, not something to art-direct. */
function ExtraSections({
  extras,
  labelStyle,
  bodyStyle,
  wrapStyle,
}: {
  extras?: BriefExtras | null;
  labelStyle: Style;
  bodyStyle: Style;
  wrapStyle: Style;
}) {
  if (!extras) return null;
  const blocks: [string, string][] = [];
  if (extras.paymentTerms) blocks.push(["Payment terms", extras.paymentTerms]);
  if (extras.revisions) blocks.push(["Revisions", extras.revisions]);
  if (extras.availability) blocks.push(["Availability", extras.availability]);
  if (extras.terms) {
    blocks.push(["Cancellation", extras.terms.cancellation]);
    blocks.push(["Ownership", extras.terms.ownership]);
    blocks.push(["Confidentiality", extras.terms.confidentiality]);
  }
  if (extras.aiUsage?.will.length) {
    blocks.push(["Where AI is used", extras.aiUsage.will.map((t) => `- ${t}`).join("\n")]);
  }
  if (extras.aiUsage?.willNot.length) {
    blocks.push(["Where it is not", extras.aiUsage.willNot.map((t) => `- ${t}`).join("\n")]);
  }
  if (!blocks.length) return null;

  return (
    <>
      {blocks.map(([label, text]) => (
        <View key={label} style={wrapStyle} minPresenceAhead={64}>
          <Text style={labelStyle}>{label}</Text>
          <Text style={bodyStyle}>{text}</Text>
        </View>
      ))}
    </>
  );
}

function Examples({ examples }: { examples?: BriefExamplePdfData[] }) {
  if (!examples || examples.length === 0) return null;
  return (
    <>
      {examples.map((ex, i) => (
        <View key={i} style={styles.exampleBlock}>
          <Image src={ex.dataUrl} style={styles.exampleImage} />
          <Text style={styles.exampleName}>{ex.name}</Text>
          <Text style={styles.exampleCaption}>{ex.caption}</Text>
        </View>
      ))}
    </>
  );
}

/** Classic — dark cover band with a 3-up stat row (total / hours / rate),
 * pill-badge section eyebrows, and tinted-background section cards. */
function ClassicDocument({ brief }: { brief: BriefPdfData }) {
  const accent = brief.brandAccentColor || FREELY_VIOLET;
  const symbol = currencySymbol(brief.currency);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <BrandMark brief={brief} />
          <Text style={styles.coverEyebrow}>Quotation</Text>
          <Text style={styles.coverTitle}>{brief.title}</Text>
          <Text style={styles.coverMeta}>
            <Text style={styles.coverMetaBold}>{brief.client}</Text>
            {" · "}
            {formatQuoteDate(brief.createdAt)}
          </Text>
          <View style={styles.coverDivider} />
          <View style={styles.coverStatRow}>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatValue}>
                {symbol}
                {brief.price.toLocaleString()}
              </Text>
              <Text style={styles.coverStatLabel}>Total</Text>
            </View>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatValue}>
                {unitsFromHours(brief.hours, parseRateUnit(brief.rateUnit))}
                {parseRateUnit(brief.rateUnit) === "DAY" ? "d" : "h"}
              </Text>
              <Text style={styles.coverStatLabel}>
                {parseRateUnit(brief.rateUnit) === "DAY" ? "Estimated days" : "Estimated hours"}
              </Text>
            </View>
            {brief.hourlyRate && (
              <View style={styles.coverStat}>
                <Text style={styles.coverStatValue}>
                  {symbol}
                  {brief.hourlyRate}
                </Text>
                <Text style={styles.coverStatLabel}>Per hour</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {brief.strategy && (
            <View style={[styles.section, styles.sectionViolet]} minPresenceAhead={64}>
              <Pill text="Strategy" tint="rgba(99,32,238,0.12)" color={FREELY_VIOLET} />
              <Text style={[styles.body, styles.semibold]}>{brief.strategy.goal}</Text>
              {brief.strategy.findings.length > 0 && (
                <>
                  <Text style={[styles.subLabel, { color: "#565656" }]}>Findings</Text>
                  <Bullets items={brief.strategy.findings} />
                </>
              )}

            </View>
          )}

          <View style={[styles.section, styles.sectionPaper]} minPresenceAhead={64}>
            <Pill text="Scope" tint="#EFEFEF" color="#565656" />
            <Prose text={brief.scope} />
          </View>

          <View style={[styles.section, styles.sectionCoral]} minPresenceAhead={120}>
            <Pill text="Deliverables" tint="rgba(244,91,105,0.14)" color={FREELY_CORAL} />
            {brief.deliverables.map((d, i) => (
              <DeliverableLine key={i} text={d} />
            ))}
          </View>

          <View style={[styles.section, styles.sectionPaper]} minPresenceAhead={64}>
            <Pill text="Timeline" tint="#EFEFEF" color="#565656" />
            <TimelineVisual timeline={brief.timeline} dotColor={accent} />
          </View>

          <View style={styles.investmentRow} minPresenceAhead={64}>
            <View>
              <Text style={styles.investmentLabel}>Investment</Text>
              <Text style={styles.investmentMeta}>
                {describeEffort(brief.hours, parseRateUnit(brief.rateUnit))}
                {brief.hourlyRate
                  ? ` · ${symbol}${brief.hourlyRate}${rateSuffix(parseRateUnit(brief.rateUnit))}`
                  : ""}
              </Text>
            </View>
            <Text style={[styles.price, { color: accent === FREELY_VIOLET ? "#fff" : accent }]}>
              {symbol}
              {brief.price.toLocaleString()}
            </Text>
          </View>

          {brief.examples && brief.examples.length > 0 && (
            <View style={[styles.section, styles.sectionPaper]}>
              <Pill text="Examples" tint="#EFEFEF" color="#565656" />
              <Examples examples={brief.examples} />
            </View>
          )}

          <ExtraSections
            extras={brief.extras}
            wrapStyle={{ ...styles.section, ...styles.sectionPaper }}
            labelStyle={{ ...styles.subLabel, marginTop: 0, color: "#565656" }}
            bodyStyle={styles.body}
          />

          {brief.includeSOW && (
            <View style={[styles.section, styles.sectionPaper]} minPresenceAhead={64}>
              <Pill text="Statement of Work" tint="#EFEFEF" color="#565656" />
              <Text style={styles.body}>
                This quote constitutes a Statement of Work for the deliverables listed above, to
                be completed within the stated timeline for the stated price.
              </Text>
            </View>
          )}

          {brief.includeAI && !brief.extras?.aiUsage && (
            <View minPresenceAhead={80}>
              <Text style={styles.disclosure}>
                Portions of this quote were drafted with AI assistance and reviewed before sending.
              </Text>
            </View>
          )}

        </View>

        <Footer brief={brief} />
      </Page>
    </Document>
  );
}

/** Editorial — no cover block: a large bold headline, a stat row under a
 * heavy rule, then sections separated by thin hairlines instead of tinted
 * backgrounds — a plainer, magazine-style read. */
function EditorialDocument({ brief }: { brief: BriefPdfData }) {
  const primary = brief.brandPrimaryColor || FREELY_CORAL;
  const symbol = currencySymbol(brief.currency);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.edHeader}>
          <BrandMark brief={brief} dark />
          <Text style={[styles.edEyebrow, { color: primary }]}>
            For <Text style={styles.bold}>{brief.client}</Text>
          </Text>
          <Text style={styles.edTitle}>{brief.title}</Text>
          <View style={[styles.edStatRow, { borderBottomColor: primary }]}>
            <View style={styles.edStat}>
              <Text style={styles.edStatValue}>
                {symbol}
                {brief.price.toLocaleString()}
              </Text>
              <Text style={styles.edStatLabel}>Total</Text>
            </View>
            <View style={styles.edStat}>
              <Text style={styles.edStatValue}>
                {unitsFromHours(brief.hours, parseRateUnit(brief.rateUnit))}
                {parseRateUnit(brief.rateUnit) === "DAY" ? "d" : "h"}
              </Text>
              <Text style={styles.edStatLabel}>
                {parseRateUnit(brief.rateUnit) === "DAY" ? "Estimated days" : "Estimated hours"}
              </Text>
            </View>
            {brief.hourlyRate && (
              <View style={styles.edStat}>
                <Text style={styles.edStatValue}>
                  {symbol}
                  {brief.hourlyRate}
                </Text>
                <Text style={styles.edStatLabel}>Per hour</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {brief.strategy && (
            <View style={styles.edSection} minPresenceAhead={64}>
              <Text style={[styles.edSectionTitle, { color: primary }]}>Strategy</Text>
              <Text style={[styles.body, styles.semibold]}>{brief.strategy.goal}</Text>
              {brief.strategy.findings.length > 0 && (
                <>
                  <Text style={[styles.subLabel, { color: "#565656" }]}>Findings</Text>
                  <Bullets items={brief.strategy.findings} />
                </>
              )}
            </View>
          )}

          <View style={styles.edSection} minPresenceAhead={64}>
            <Text style={[styles.edSectionTitle, { color: primary }]}>Scope</Text>
            <Prose text={brief.scope} />
          </View>

          <View style={styles.edSection} minPresenceAhead={120}>
            <Text style={[styles.edSectionTitle, { color: primary }]}>Deliverables</Text>
            {brief.deliverables.map((d, i) => (
              <DeliverableLine key={i} text={d} markColor={primary} />
            ))}
          </View>

          <View style={styles.edSection} minPresenceAhead={64}>
            <Text style={[styles.edSectionTitle, { color: primary }]}>Timeline</Text>
            <TimelineVisual timeline={brief.timeline} dotColor={primary} />
          </View>

          {brief.examples && brief.examples.length > 0 && (
            <View style={styles.edSection}>
              <Text style={[styles.edSectionTitle, { color: primary }]}>Examples</Text>
              <Examples examples={brief.examples} />
            </View>
          )}

          <ExtraSections
            extras={brief.extras}
            wrapStyle={styles.edSection}
            labelStyle={{ ...styles.edSectionTitle, fontSize: 13, color: primary }}
            bodyStyle={styles.body}
          />

          {brief.includeSOW && (
            <View style={styles.edSection} minPresenceAhead={64}>
              <Text style={[styles.edSectionTitle, { color: primary }]}>Statement of Work</Text>
              <Text style={styles.body}>
                This quote constitutes a Statement of Work for the deliverables listed above, to
                be completed within the stated timeline for the stated price.
              </Text>
            </View>
          )}

          {brief.includeAI && !brief.extras?.aiUsage && (
            <View minPresenceAhead={80}>
              <Text style={styles.disclosure}>
                Portions of this quote were drafted with AI assistance and reviewed before sending.
              </Text>
            </View>
          )}

        </View>

        <Footer brief={brief} />
      </Page>
    </Document>
  );
}

/** Minimal — plain, high-contrast, no color blocks; a heavy top rule and
 * hairline section dividers do the separating instead of backgrounds. */
function MinimalDocument({ brief }: { brief: BriefPdfData }) {
  const symbol = currencySymbol(brief.currency);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.minHeader}>
          <BrandMark brief={brief} dark />
          <Text style={styles.minEyebrow}>Quote</Text>
          <Text style={styles.minTitle}>{brief.title}</Text>
          <Text style={styles.minMeta}>
            <Text style={styles.bold}>{brief.client}</Text>
            {" · "}
            {formatQuoteDate(brief.createdAt)}
          </Text>
          <View style={styles.minStatRow}>
            <Text style={styles.minStat}>
              {symbol}
              {brief.price.toLocaleString()} total
            </Text>
            <Text style={styles.minStat}>
              {describeEffort(brief.hours, parseRateUnit(brief.rateUnit))} estimated
            </Text>
            {brief.hourlyRate && (
              <Text style={styles.minStat}>
                {symbol}
                {brief.hourlyRate}/hr
              </Text>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {brief.strategy && (
            <View style={styles.minSection} minPresenceAhead={64}>
              <Text style={styles.minLabel}>Strategy</Text>
              <Text style={[styles.body, styles.semibold]}>{brief.strategy.goal}</Text>
              {brief.strategy.findings.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Bullets items={brief.strategy.findings} />
                </View>
              )}
            </View>
          )}

          <View style={styles.minSection} minPresenceAhead={64}>
            <Text style={styles.minLabel}>Scope</Text>
            <Prose text={brief.scope} />
          </View>

          <View style={styles.minSection} minPresenceAhead={64}>
            <Text style={styles.minLabel}>Deliverables</Text>
            {brief.deliverables.map((d, i) => (
              <DeliverableLine key={i} text={d} />
            ))}
          </View>

          <View style={styles.minSection} minPresenceAhead={64}>
            <Text style={styles.minLabel}>Timeline</Text>
            <TimelineVisual timeline={brief.timeline} dotColor={FREELY_INK} />
          </View>

          {brief.examples && brief.examples.length > 0 && (
            <View style={styles.minSection}>
              <Text style={styles.minLabel}>Examples</Text>
              <Examples examples={brief.examples} />
            </View>
          )}

          <ExtraSections
            extras={brief.extras}
            wrapStyle={styles.minSection}
            labelStyle={styles.minLabel}
            bodyStyle={styles.body}
          />

          {brief.includeSOW && (
            <View style={styles.minSection} minPresenceAhead={64}>
              <Text style={styles.minLabel}>Statement of Work</Text>
              <Text style={styles.body}>
                This quote constitutes a Statement of Work for the deliverables listed above, to
                be completed within the stated timeline for the stated price.
              </Text>
            </View>
          )}

          {brief.includeAI && !brief.extras?.aiUsage && (
            <View minPresenceAhead={80}>
              <Text style={styles.disclosure}>
                Portions of this quote were drafted with AI assistance and reviewed before sending.
              </Text>
            </View>
          )}

        </View>

        <Footer brief={brief} />
      </Page>
    </Document>
  );
}

/** Mono — a deliberately generic, brandless black-and-white layout for when
 * a quote shouldn't carry either Freely's or the freelancer's own
 * colors/logo (see lib/branding.ts). Mirrors the Minimal layout's structure
 * but with every color computed from `dark` instead of pulled from brand
 * fields, and no logo/wordmark shown at all. */
function MonoDocument({ brief, dark }: { brief: BriefPdfData; dark: boolean }) {
  const symbol = currencySymbol(brief.currency);
  const bg = dark ? "#0B0B0C" : "#FFFFFF";
  const ink = dark ? "#FFFFFF" : "#111111";
  const muted = dark ? "#9A9AA0" : "#6B6B70";
  // Solid hex, not rgba: react-pdf renders rgba border colours unpredictably.
  const line = dark ? "#2E2E31" : "#D9D9DE";
  const page = { ...styles.page, backgroundColor: bg, color: ink };
  const body = { ...styles.body, color: ink };
  return (
    <Document>
      <Page size="A4" style={page}>
        <View style={{ paddingHorizontal: 44, paddingTop: 36, paddingBottom: 18, borderBottomWidth: 1.5, borderBottomColor: ink }}>
          <Text style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: 2, color: muted, marginTop: 18 }}>
            Quote
          </Text>
          <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 8, color: ink }}>{brief.title}</Text>
          <Text style={{ fontSize: 9.5, color: muted, marginTop: 4 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: ink }}>{brief.client}</Text>
            {" · "}
            {formatQuoteDate(brief.createdAt)}
          </Text>
          <View style={{ flexDirection: "row", marginTop: 14 }}>
            <Text style={{ fontSize: 10.5, marginRight: 22, fontFamily: "Helvetica-Bold", color: ink }}>
              {symbol}
              {brief.price.toLocaleString()} total
            </Text>
            <Text style={{ fontSize: 10.5, marginRight: 22, fontFamily: "Helvetica-Bold", color: ink }}>
              {describeEffort(brief.hours, parseRateUnit(brief.rateUnit))} estimated
            </Text>
            {brief.hourlyRate && (
              <Text style={{ fontSize: 10.5, fontFamily: "Helvetica-Bold", color: ink }}>
                {symbol}
                {brief.hourlyRate}/hr
              </Text>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {brief.strategy && (
            <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }} minPresenceAhead={64}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
                Strategy
              </Text>
              <Text style={[body, styles.semibold]}>{brief.strategy.goal}</Text>
              {brief.strategy.findings.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {brief.strategy.findings.map((f, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Text style={{ ...styles.bulletMark, color: ink }}>•</Text>
                      <Text style={{ ...styles.bulletText, color: ink }}>{f}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }} minPresenceAhead={64}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
              Scope
            </Text>
            <Prose text={brief.scope} style={body} />
          </View>

          <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }} minPresenceAhead={64}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
              Deliverables
            </Text>
            {brief.deliverables.map((d, i) => (
              <DeliverableLine key={i} text={d} markColor={ink} textColor={ink} detailColor={muted} />
            ))}
          </View>

          <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }} minPresenceAhead={64}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
              Timeline
            </Text>
            <TimelineVisual
              timeline={brief.timeline}
              dotColor={ink}
              textColor={ink}
              mutedColor={muted}
            />
          </View>

          {brief.examples && brief.examples.length > 0 && (
            <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
                Examples
              </Text>
              <Examples examples={brief.examples} />
            </View>
          )}

          <ExtraSections
            extras={brief.extras}
            wrapStyle={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }}
            labelStyle={{
              fontSize: 9,
              fontFamily: "Helvetica-Bold",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: S2,
              color: ink,
            }}
            bodyStyle={{ ...styles.body, color: ink }}
          />

          {brief.includeSOW && (
            <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }} minPresenceAhead={64}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
                Statement of Work
              </Text>
              <Text style={body}>
                This quote constitutes a Statement of Work for the deliverables listed above, to
                be completed within the stated timeline for the stated price.
              </Text>
            </View>
          )}

          {brief.includeAI && !brief.extras?.aiUsage && (
            <View minPresenceAhead={80}>
              <Text style={{ ...styles.disclosure, color: muted }}>
                Portions of this quote were drafted with AI assistance and reviewed before sending.
              </Text>
            </View>
          )}

        </View>

        <Footer brief={brief} emailColor={muted} metaColor={muted} ruleColor={line} />
      </Page>
    </Document>
  );
}

/** A deliverable as a name with its description underneath, rather than one
 * long bold run. */
function DeliverableLine({
  text,
  markColor,
  textColor,
  detailColor,
}: {
  text: string;
  markColor?: string;
  textColor?: string;
  detailColor?: string;
}) {
  const { lead, detail } = splitDeliverable(text);
  return (
    <View style={[styles.deliverableRow, { marginBottom: detail ? S3 + 2 : S2 }]} wrap={false}>
      <Text style={[styles.deliverableMark, markColor ? { color: markColor } : {}]}>•</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.deliverableLead, textColor ? { color: textColor } : {}]}>{lead}</Text>
        {detail ? (
          <Text style={[styles.deliverableDetail, detailColor ? { color: detailColor } : {}]}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Generated prose as separate paragraphs, so a long scope has some air in
 * it instead of arriving as one block. */
function Prose({ text, style }: { text: string; style?: Style }) {
  const parts = paragraphs(text);
  return (
    <>
      {parts.map((p, i) => (
        <Text key={i} style={[style ?? styles.body, i > 0 ? { marginTop: S3 } : {}]}>
          {p}
        </Text>
      ))}
    </>
  );
}

export async function renderBriefPdf(brief: BriefPdfData): Promise<Buffer> {
  if (brief.mono) return renderToBuffer(<MonoDocument brief={brief} dark={Boolean(brief.dark)} />);

  const template = brief.template || "classic";
  const doc =
    template === "editorial" ? (
      <EditorialDocument brief={brief} />
    ) : template === "minimal" ? (
      <MinimalDocument brief={brief} />
    ) : (
      <ClassicDocument brief={brief} />
    );
  return renderToBuffer(doc);
}
