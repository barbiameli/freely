import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { currencySymbol } from "@/lib/currencies";

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

// Freely's own palette — used as the fixed identity color for things like
// the "AI will / AI will not" split, so it never clashes with whatever a
// user has picked as their own brand primary/accent.
const FREELY_VIOLET = "#6320EE";
const FREELY_CORAL = "#F45B69";
const FREELY_INK = "#181722";

const styles = StyleSheet.create({
  page: { padding: 0, fontSize: 11, fontFamily: "Helvetica", color: "#343434" },
  body: { fontSize: 11, lineHeight: 1.6, color: "#343434" },
  bold: { fontWeight: 700 },
  semibold: { fontWeight: 600 },

  // Shared "content" padding wrapper — the cover block bleeds full-width,
  // everything else sits inside this. Generous padding/spacing throughout
  // so the page reads as airy rather than dense.
  content: { paddingHorizontal: 52, paddingTop: 4, paddingBottom: 56 },

  logoImg: { height: 20, objectFit: "contain" },
  logoImgFooter: { height: 14, objectFit: "contain", marginBottom: 4 },
  wordmark: { fontSize: 13, fontWeight: 700, color: "#ffffff" },
  wordmarkDark: { fontSize: 12, fontWeight: 700, color: FREELY_INK },

  // Classic — dark cover band (logo/wordmark top-left, eyebrow, bold title,
  // client/date line, a 3-up stat row), then pill-labeled, tinted-background
  // section cards below.
  cover: { backgroundColor: FREELY_INK, padding: 40, paddingBottom: 36, marginBottom: 32 },
  coverEyebrow: { fontSize: 9, color: FREELY_CORAL, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginTop: 22 },
  coverTitle: { fontSize: 26, color: "#ffffff", marginTop: 10, fontWeight: 700 },
  coverMeta: { fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 7 },
  coverMetaBold: { fontWeight: 700, color: "rgba(255,255,255,0.85)" },
  coverDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", marginTop: 24, marginBottom: 20 },
  coverStatRow: { flexDirection: "row" },
  coverStat: { marginRight: 38 },
  coverStatValue: { fontSize: 20, color: "#ffffff", fontWeight: 700 },
  coverStatLabel: { fontSize: 7.5, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },

  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 10 },
  pillText: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 },

  section: { borderRadius: 10, padding: 22, marginBottom: 18 },
  sectionCoral: { backgroundColor: "rgba(244,91,105,0.08)" },
  sectionViolet: { backgroundColor: "rgba(99,32,238,0.07)" },
  sectionPaper: { backgroundColor: "#F8F9FA" },

  bulletRow: { flexDirection: "row", marginBottom: 7 },
  bulletMark: { width: 12, fontSize: 10, color: FREELY_CORAL },
  bulletText: { flex: 1, fontSize: 10.5, lineHeight: 1.6, color: "#343434" },
  subLabel: { fontSize: 8.5, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 14, fontWeight: 700 },
  deliverableRow: { flexDirection: "row", alignItems: "flex-start", fontSize: 11, paddingVertical: 6 },
  deliverableMark: { width: 14, fontSize: 10, color: FREELY_CORAL },
  deliverableText: { flex: 1, fontWeight: 600, lineHeight: 1.5 },

  investmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
    padding: 18,
    borderRadius: 8,
    backgroundColor: FREELY_INK,
  },
  investmentLabel: { fontSize: 8.5, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 1 },
  investmentMeta: { fontSize: 10, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  price: { fontSize: 21, color: "#fff", fontWeight: 700 },

  disclosure: { fontSize: 9, color: "#8A8990", marginTop: 14 },
  exampleBlock: { marginTop: 12 },
  exampleImage: { width: "100%", height: 150, borderRadius: 6, objectFit: "cover" },
  exampleName: { fontSize: 9.5, fontWeight: 700, marginTop: 7 },
  exampleCaption: { fontSize: 9.5, color: "#565656", marginTop: 2, lineHeight: 1.5 },

  // Timeline drawn as a simple horizontal roadmap — a rule with a dot per
  // stage and the stage text underneath — instead of one paragraph.
  timelineWrap: { marginTop: 4 },
  timelineLine: { borderTopWidth: 2, marginTop: 9 },
  timelineStages: { flexDirection: "row", marginTop: -5 },
  timelineStage: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  timelineDot: { width: 9, height: 9, borderRadius: 5, marginBottom: 8 },
  timelineLabel: { fontSize: 8.5, textAlign: "center", lineHeight: 1.4, color: "#343434" },

  footer: {
    borderTopWidth: 1,
    borderTopColor: "#E8EAEF",
    marginTop: 24,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerEmail: { fontSize: 9, color: FREELY_CORAL },
  footerMeta: { fontSize: 9, color: "#8A8990", textAlign: "right" },

  // Editorial — no cover block, large bold headline, thin colored rule
  // dividers between sections instead of tinted backgrounds.
  edHeader: { paddingHorizontal: 48, paddingTop: 40, paddingBottom: 4 },
  edEyebrow: { fontSize: 10, textTransform: "uppercase", letterSpacing: 2, marginTop: 20 },
  edTitle: { fontSize: 32, marginTop: 12, color: FREELY_INK, fontWeight: 700 },
  edStatRow: { flexDirection: "row", marginTop: 28, paddingBottom: 24, borderBottomWidth: 1.5 },
  edStat: { marginRight: 44 },
  edStatValue: { fontSize: 22, color: FREELY_INK, fontWeight: 700 },
  edStatLabel: { fontSize: 8, color: "#8A8990", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },
  edSection: { paddingVertical: 28, borderBottomWidth: 1, borderBottomColor: "#E8EAEF" },
  edSectionTitle: { fontSize: 16, marginBottom: 12, fontWeight: 700 },

  // Minimal — plain, no color blocks, hairline rules, letter-spaced labels.
  minHeader: { paddingHorizontal: 44, paddingTop: 36, paddingBottom: 18, borderBottomWidth: 1.5, borderBottomColor: FREELY_INK },
  minEyebrow: { fontSize: 8.5, textTransform: "uppercase", letterSpacing: 2, color: "#8A8990", marginTop: 18 },
  minTitle: { fontSize: 20, fontWeight: 700, marginTop: 8, color: FREELY_INK },
  minMeta: { fontSize: 9.5, color: "#8A8990", marginTop: 4 },
  minStatRow: { flexDirection: "row", marginTop: 14 },
  minStat: { fontSize: 10.5, marginRight: 22, fontWeight: 700 },
  minSection: { paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: "#E8EAEF" },
  minLabel: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
});

/** Splits a freeform timeline string into stages for the visual roadmap.
 * Tries, in order: explicit newlines, "Week/Month/Phase/Day N" boundaries,
 * then semicolons. Falls back to a single stage (caller renders plain text
 * instead of a roadmap when there's only one). */
function parseTimelineStages(timeline: string): string[] {
  const clean = (s: string) => s.replace(/^[-•·]\s*/, "").trim();
  let stages = timeline
    .split("\n")
    .map(clean)
    .filter(Boolean);
  if (stages.length < 2) {
    stages = timeline
      .split(/(?=(?:Week|Weeks|Month|Months|Phase|Day|Days|Stage)\s+\d)/i)
      .map(clean)
      .filter(Boolean);
  }
  if (stages.length < 2) {
    stages = timeline.split(";").map(clean).filter(Boolean);
  }
  return stages;
}

function TimelineVisual({ timeline, dotColor }: { timeline: string; dotColor: string }) {
  const stages = parseTimelineStages(timeline);
  if (stages.length < 2 || stages.some((s) => s.length > 220)) {
    return <Text style={styles.body}>{timeline}</Text>;
  }
  return (
    <View style={styles.timelineWrap}>
      <View style={[styles.timelineLine, { borderTopColor: dotColor }]} />
      <View style={styles.timelineStages}>
        {stages.map((s, i) => (
          <View key={i} style={styles.timelineStage}>
            <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
            <Text style={styles.timelineLabel}>{s}</Text>
          </View>
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

function Footer({ brief }: { brief: BriefPdfData }) {
  return (
    <View style={styles.footer}>
      <View>
        {brief.brandLogoDataUrl && <Image src={brief.brandLogoDataUrl} style={styles.logoImgFooter} />}
        {brief.preparedByEmail && <Text style={styles.footerEmail}>{brief.preparedByEmail}</Text>}
      </View>
      <Text style={styles.footerMeta}>
        Prepared {new Date(brief.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </Text>
    </View>
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
            {new Date(brief.createdAt).toLocaleDateString()}
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
              <Text style={styles.coverStatValue}>{brief.hours}h</Text>
              <Text style={styles.coverStatLabel}>Estimated hours</Text>
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
            <View style={[styles.section, styles.sectionViolet]} wrap={false}>
              <Pill text="Strategy" tint="rgba(99,32,238,0.12)" color={FREELY_VIOLET} />
              <Text style={[styles.body, styles.semibold]}>{brief.strategy.goal}</Text>
              {brief.strategy.findings.length > 0 && (
                <>
                  <Text style={[styles.subLabel, { color: "#565656" }]}>Findings</Text>
                  <Bullets items={brief.strategy.findings} />
                </>
              )}
              {brief.strategy.openQuestions.length > 0 && (
                <>
                  <Text style={[styles.subLabel, { color: "#565656" }]}>Open questions</Text>
                  <Bullets items={brief.strategy.openQuestions} />
                </>
              )}
            </View>
          )}

          <View style={[styles.section, styles.sectionPaper]} wrap={false}>
            <Pill text="Scope" tint="#EFEFEF" color="#565656" />
            <Text style={styles.body}>{brief.scope}</Text>
          </View>

          <View style={[styles.section, styles.sectionCoral]} wrap={false}>
            <Pill text="Deliverables" tint="rgba(244,91,105,0.14)" color={FREELY_CORAL} />
            {brief.deliverables.map((d, i) => (
              <View key={i} style={styles.deliverableRow}>
                <Text style={styles.deliverableMark}>•</Text>
                <Text style={styles.deliverableText}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.section, styles.sectionPaper]} wrap={false}>
            <Pill text="Timeline" tint="#EFEFEF" color="#565656" />
            <TimelineVisual timeline={brief.timeline} dotColor={accent} />
          </View>

          <View style={styles.investmentRow} wrap={false}>
            <View>
              <Text style={styles.investmentLabel}>Investment</Text>
              <Text style={styles.investmentMeta}>
                {brief.hours} hours{brief.hourlyRate ? ` · ~${symbol}${brief.hourlyRate}/hr` : ""}
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

          {brief.includeSOW && (
            <View style={[styles.section, styles.sectionPaper]} wrap={false}>
              <Pill text="Statement of Work" tint="#EFEFEF" color="#565656" />
              <Text style={styles.body}>
                This quote constitutes a Statement of Work for the deliverables listed above, to
                be completed within the stated timeline for the stated price.
              </Text>
            </View>
          )}

          {brief.includeAI && (
            <Text style={styles.disclosure}>
              Portions of this quote were drafted with AI assistance and reviewed before sending.
            </Text>
          )}

          <Footer brief={brief} />
        </View>
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
              <Text style={styles.edStatValue}>{brief.hours}h</Text>
              <Text style={styles.edStatLabel}>Estimated hours</Text>
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
            <View style={styles.edSection} wrap={false}>
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

          <View style={styles.edSection} wrap={false}>
            <Text style={[styles.edSectionTitle, { color: primary }]}>Scope</Text>
            <Text style={styles.body}>{brief.scope}</Text>
          </View>

          <View style={styles.edSection} wrap={false}>
            <Text style={[styles.edSectionTitle, { color: primary }]}>Deliverables</Text>
            {brief.deliverables.map((d, i) => (
              <View key={i} style={styles.deliverableRow}>
                <Text style={[styles.deliverableMark, { color: primary }]}>•</Text>
                <Text style={styles.deliverableText}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={styles.edSection} wrap={false}>
            <Text style={[styles.edSectionTitle, { color: primary }]}>Timeline</Text>
            <TimelineVisual timeline={brief.timeline} dotColor={primary} />
          </View>

          {brief.examples && brief.examples.length > 0 && (
            <View style={styles.edSection}>
              <Text style={[styles.edSectionTitle, { color: primary }]}>Examples</Text>
              <Examples examples={brief.examples} />
            </View>
          )}

          {brief.includeSOW && (
            <View style={styles.edSection} wrap={false}>
              <Text style={[styles.edSectionTitle, { color: primary }]}>Statement of Work</Text>
              <Text style={styles.body}>
                This quote constitutes a Statement of Work for the deliverables listed above, to
                be completed within the stated timeline for the stated price.
              </Text>
            </View>
          )}

          {brief.includeAI && (
            <Text style={styles.disclosure}>
              Portions of this quote were drafted with AI assistance and reviewed before sending.
            </Text>
          )}

          <Footer brief={brief} />
        </View>
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
            {new Date(brief.createdAt).toLocaleDateString()}
          </Text>
          <View style={styles.minStatRow}>
            <Text style={styles.minStat}>
              {symbol}
              {brief.price.toLocaleString()} total
            </Text>
            <Text style={styles.minStat}>{brief.hours}h estimated</Text>
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
            <View style={styles.minSection} wrap={false}>
              <Text style={styles.minLabel}>Strategy</Text>
              <Text style={[styles.body, styles.semibold]}>{brief.strategy.goal}</Text>
              {brief.strategy.findings.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Bullets items={brief.strategy.findings} />
                </View>
              )}
            </View>
          )}

          <View style={styles.minSection} wrap={false}>
            <Text style={styles.minLabel}>Scope</Text>
            <Text style={styles.body}>{brief.scope}</Text>
          </View>

          <View style={styles.minSection} wrap={false}>
            <Text style={styles.minLabel}>Deliverables</Text>
            {brief.deliverables.map((d, i) => (
              <View key={i} style={styles.deliverableRow}>
                <Text style={styles.deliverableMark}>•</Text>
                <Text style={styles.deliverableText}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={styles.minSection} wrap={false}>
            <Text style={styles.minLabel}>Timeline</Text>
            <TimelineVisual timeline={brief.timeline} dotColor={FREELY_INK} />
          </View>

          {brief.examples && brief.examples.length > 0 && (
            <View style={styles.minSection}>
              <Text style={styles.minLabel}>Examples</Text>
              <Examples examples={brief.examples} />
            </View>
          )}

          {brief.includeSOW && (
            <View style={styles.minSection} wrap={false}>
              <Text style={styles.minLabel}>Statement of Work</Text>
              <Text style={styles.body}>
                This quote constitutes a Statement of Work for the deliverables listed above, to
                be completed within the stated timeline for the stated price.
              </Text>
            </View>
          )}

          {brief.includeAI && (
            <Text style={styles.disclosure}>
              Portions of this quote were drafted with AI assistance and reviewed before sending.
            </Text>
          )}

          <Footer brief={brief} />
        </View>
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
  const muted = dark ? "rgba(255,255,255,0.55)" : "rgba(17,17,17,0.55)";
  const line = dark ? "rgba(255,255,255,0.18)" : "rgba(17,17,17,0.18)";
  const page = { ...styles.page, backgroundColor: bg, color: ink };
  const body = { ...styles.body, color: ink };
  return (
    <Document>
      <Page size="A4" style={page}>
        <View style={{ paddingHorizontal: 44, paddingTop: 36, paddingBottom: 18, borderBottomWidth: 1.5, borderBottomColor: ink }}>
          <Text style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: 2, color: muted, marginTop: 18 }}>
            Quote
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: ink }}>{brief.title}</Text>
          <Text style={{ fontSize: 9.5, color: muted, marginTop: 4 }}>
            <Text style={{ fontWeight: 700, color: ink }}>{brief.client}</Text>
            {" · "}
            {new Date(brief.createdAt).toLocaleDateString()}
          </Text>
          <View style={{ flexDirection: "row", marginTop: 14 }}>
            <Text style={{ fontSize: 10.5, marginRight: 22, fontWeight: 700, color: ink }}>
              {symbol}
              {brief.price.toLocaleString()} total
            </Text>
            <Text style={{ fontSize: 10.5, marginRight: 22, fontWeight: 700, color: ink }}>
              {brief.hours}h estimated
            </Text>
            {brief.hourlyRate && (
              <Text style={{ fontSize: 10.5, fontWeight: 700, color: ink }}>
                {symbol}
                {brief.hourlyRate}/hr
              </Text>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {brief.strategy && (
            <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }} wrap={false}>
              <Text style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
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

          <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }} wrap={false}>
            <Text style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
              Scope
            </Text>
            <Text style={body}>{brief.scope}</Text>
          </View>

          <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }} wrap={false}>
            <Text style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
              Deliverables
            </Text>
            {brief.deliverables.map((d, i) => (
              <View key={i} style={styles.deliverableRow}>
                <Text style={{ ...styles.deliverableMark, color: ink }}>•</Text>
                <Text style={{ ...styles.deliverableText, color: ink }}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }} wrap={false}>
            <Text style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
              Timeline
            </Text>
            <TimelineVisual timeline={brief.timeline} dotColor={ink} />
          </View>

          {brief.examples && brief.examples.length > 0 && (
            <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }}>
              <Text style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
                Examples
              </Text>
              <Examples examples={brief.examples} />
            </View>
          )}

          {brief.includeSOW && (
            <View style={{ paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: line }} wrap={false}>
              <Text style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, color: ink }}>
                Statement of Work
              </Text>
              <Text style={body}>
                This quote constitutes a Statement of Work for the deliverables listed above, to
                be completed within the stated timeline for the stated price.
              </Text>
            </View>
          )}

          {brief.includeAI && (
            <Text style={{ ...styles.disclosure, color: muted }}>
              Portions of this quote were drafted with AI assistance and reviewed before sending.
            </Text>
          )}

          <View style={{ borderTopWidth: 1, borderTopColor: line, marginTop: 24, paddingTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <Text style={{ fontSize: 9, color: muted }}>
              {brief.preparedByEmail || ""}
            </Text>
            <Text style={{ fontSize: 9, color: muted, textAlign: "right" }}>
              Prepared {new Date(brief.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
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
