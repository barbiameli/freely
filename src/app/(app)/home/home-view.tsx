"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoney, totalInOneCurrency } from "@/lib/money";
import { useT } from "@/lib/i18n/context";
import { fill, type Dictionary } from "@/lib/i18n";
import type { Pattern } from "@/lib/quote-patterns";
import { applyPatternFixAction } from "@/actions/patterns";

export interface HomeQuote {
  id: string;
  title: string;
  client: string;
  price: number;
  currency: string | null;
  published: boolean;
  tracked: boolean;
  outcome: string;
  unseenAcceptance: boolean;
  /** Days since it was published, or null when it never was. */
  waitingDays: number | null;
  createdAt: string;
}

export interface HomeProject {
  id: string;
  title: string;
  client: string;
  price: number;
  currency: string | null;
  done: number;
  total: number;
  /** Negative when something is already late. Null when nothing has a date. */
  nextDueInDays: number | null;
}

export interface HomeInvoice {
  id: string;
  number: number;
  client: string;
  total: number;
  currency: string;
  /** Positive when it is past its due date. */
  overdueDays: number;
}

/** A stage waiting on the client, and what the clause says about it. */
export interface HomeStage {
  kind: "deemedAccepted" | "feedbackOverdue";
  projectId: string;
  projectTitle: string;
  client: string;
  name: string;
  amount: number;
  currency: string | null;
  businessDays: number;
}

export interface HomeData {
  /**
   * The acceptance and feedback clauses, actually running.
   *
   * The quote says delivered work with no response after so many business days
   * counts as accepted and is invoiced. Nothing used to watch for that, so the
   * sentence sat on the document while somebody waited.
   */
  stages: HomeStage[];
  /**
   * What their own quoting looks like across a run of quotes, against what
   * freelancers like them do. See lib/quote-patterns.
   */
  patterns: Pattern[];
  /** When the comparison figures were last researched. */
  researchedAt: string | null;
  /** Where those figures came from, so any of them can be traced. */
  sources: { title: string; url: string }[];
  quotes: HomeQuote[];
  projects: HomeProject[];
  invoices: HomeInvoice[];
}

/** A figure, and an honest note when rows in other currencies were left out. */
function withOthers(text: string, others: number, t: Dictionary): string {
  return others > 0 ? `${text} ${t.home.plusOtherCurrencies.replace("{count}", String(others))}` : text;
}

/** One thing that wants doing, and where to do it. */
interface Item {
  key: string;
  text: string;
  href: string;
  urgent: boolean;
}

/**
 * What needs you, worked out from what exists.
 *
 * The ordering is the whole value of this list: a signed quote nobody has
 * seen, then money that is late, then work that is late, then a quote that
 * has gone quiet. Anything that is merely in progress is not on it, because a
 * list of everything is a list nobody reads.
 */
function needsYou(data: HomeData, t: Dictionary): Item[] {
  const items: Item[] = [];

  for (const quote of data.quotes) {
    if (quote.unseenAcceptance) {
      items.push({
        key: `signed-${quote.id}`,
        text: t.home.needSigned.replace("{client}", quote.client || t.home.aClient),
        href: `/quote/${quote.id}`,
        urgent: true,
      });
    }
  }
  /**
   * Said before the overdue invoices, because it is money that has not been
   * asked for yet, which is worse than money that has been asked for and not
   * arrived.
   */
  for (const stage of data.stages) {
    if (stage.kind === "deemedAccepted") {
      items.push({
        key: `accepted-${stage.projectId}-${stage.name}`,
        text: t.home.needStageAccepted
          .replace("{stage}", stage.name)
          .replace("{days}", String(stage.businessDays)),
        href: `/track/${stage.projectId}`,
        urgent: true,
      });
    }
  }
  for (const invoice of data.invoices) {
    if (invoice.overdueDays > 0) {
      items.push({
        key: `late-${invoice.id}`,
        text: t.home.needInvoiceLate
          .replace("{amount}", formatMoney(invoice.total, invoice.currency))
          .replace("{days}", String(invoice.overdueDays)),
        href: `/invoices/${invoice.id}`,
        urgent: true,
      });
    }
  }
  for (const stage of data.stages) {
    if (stage.kind === "feedbackOverdue") {
      items.push({
        key: `feedback-${stage.projectId}-${stage.name}`,
        text: t.home.needStageFeedback
          .replace("{stage}", stage.name)
          .replace("{client}", stage.client || t.home.aClient)
          .replace("{days}", String(stage.businessDays)),
        href: `/track/${stage.projectId}`,
        urgent: false,
      });
    }
  }
  for (const project of data.projects) {
    if (project.nextDueInDays !== null && project.nextDueInDays < 0) {
      items.push({
        key: `overdue-${project.id}`,
        text: t.home.needProjectLate
          .replace("{title}", project.title)
          .replace("{days}", String(Math.abs(project.nextDueInDays))),
        href: `/track/${project.id}`,
        urgent: false,
      });
    }
  }
  for (const quote of data.quotes) {
    // Published, unanswered, and old enough that chasing it is reasonable
    // rather than impatient.
    if (
      quote.published &&
      !quote.tracked &&
      quote.outcome === "PENDING" &&
      (quote.waitingDays ?? 0) >= 7
    ) {
      items.push({
        key: `quiet-${quote.id}`,
        text: t.home.needQuoteQuiet
          .replace("{client}", quote.client || t.home.aClient)
          .replace("{days}", String(quote.waitingDays)),
        href: `/quote/${quote.id}`,
        urgent: false,
      });
    }
  }

  return items;
}

/**
 * The landing page.
 *
 * Signing in used to open the quote form, which assumes somebody came here to
 * write a new quote. Usually they came to find out where the last one got to.
 * So: what needs you, then the money in flight, then the three lists it comes
 * from. Writing a new quote is still one press away, at the top, where a
 * primary action belongs rather than as the whole screen.
 */
export function HomeView({ data, name }: { data: HomeData; name: string }) {
  const t = useT();
  /** The pattern currently being acted on, and the ones already settled. */
  const [fixing, setFixing] = useState("");
  const [done, setDone] = useState<string[]>([]);
  const [fixError, setFixError] = useState("");

  async function applyFix(pattern: Pattern) {
    if (!pattern.fix) return;
    setFixError("");
    setFixing(pattern.key);
    const result = await applyPatternFixAction(pattern.fix);
    setFixing("");
    if (!result.ok) {
      setFixError(result.error);
      return;
    }
    // Marked here rather than waiting for the page to recompute: the change is
    // made, and a button that still reads "make this change" says otherwise.
    setDone((current) => [...current, pattern.key]);
  }

  const items = needsYou(data, t);

  // Only the quotes still out: a tracked or lost quote is not money in flight,
  // and counting it would make the figure a total of everything ever written.
  const outstanding = data.quotes.filter(
    (q) => q.published && !q.tracked && q.outcome === "PENDING"
  );
  /**
   * Each figure in one currency, or not at all.
   *
   * These used to sum everything and label it with the first row's currency,
   * which is a wrong answer with a confident face on any account working in
   * two. See lib/money.
   */
  const owedTotal = totalInOneCurrency(
    data.invoices.map((invoice) => ({ amount: invoice.total, currency: invoice.currency }))
  );
  const outTotal = totalInOneCurrency(
    outstanding.map((quote) => ({ amount: quote.price, currency: quote.currency }))
  );
  const inHandTotal = totalInOneCurrency(
    data.projects.map((project) => ({ amount: project.price, currency: project.currency }))
  );
  const nothingYet =
    data.quotes.length === 0 && data.projects.length === 0 && data.invoices.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={name ? t.home.titleNamed.replace("{name}", name.split(" ")[0]) : t.home.title}
        subtitle={nothingYet ? t.home.emptySubtitle : t.home.subtitle}
        action={
          <Link href="/quote" className="no-underline">
            <Button icon={Plus}>{t.home.newQuote}</Button>
          </Link>
        }
      />

      {nothingYet ? (
        <Card>
          <p className="text-small text-slate m-0 max-w-prose text-pretty">{t.home.emptyBody}</p>
        </Card>
      ) : (
        <>
          {/* Said first and said plainly. Everything else on this page is a
              list you scan; this is the part somebody actually came for. */}
          {items.length > 0 && (
            <Card>
              <div className="font-body font-bold text-caption uppercase tracking-[0.08em] text-slate">
                {t.home.needsYou}
              </div>
              <ul className="list-none p-0 m-0 mt-3 flex flex-col">
                {items.slice(0, 6).map((item) => (
                  <li key={item.key} className="border-b border-line/70 last:border-b-0">
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 py-3 no-underline tap-row"
                    >
                      <span
                        className={`text-small text-pretty ${
                          item.urgent ? "font-body font-semibold text-ink" : "text-slate"
                        }`}
                      >
                        {item.text}
                      </span>
                      <ArrowRight size={14} className="text-text-muted shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Three numbers, not nine. Quotes waiting on an answer, work in
              hand, and money owed: the questions a freelancer opens an app to
              answer before eleven in the morning. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Figure
              label={t.home.outWithClients}
              value={String(outstanding.length)}
              note={
                outstanding.length > 0
                  ? withOthers(formatMoney(outTotal.total, outTotal.currency), outTotal.otherCurrencies, t)
                  : t.home.none
              }
              href="/quote"
            />
            <Figure
              label={t.home.inHand}
              value={String(data.projects.length)}
              note={
                data.projects.length > 0
                  ? withOthers(
                      formatMoney(inHandTotal.total, inHandTotal.currency),
                      inHandTotal.otherCurrencies,
                      t
                    )
                  : t.home.none
              }
              href="/track"
            />
            <Figure
              label={t.home.owedToYou}
              value={
                owedTotal.total > 0
                  ? formatMoney(owedTotal.total, owedTotal.currency)
                  : t.home.none
              }
              note={
                data.invoices.length > 0
                  ? withOthers(
                      t.home.unpaidCount.replace("{count}", String(data.invoices.length)),
                      owedTotal.otherCurrencies,
                      t
                    )
                  : t.home.allSettled
              }
              href="/invoices"
            />
          </div>

          {data.projects.length > 0 && (
            <Section title={t.home.workInHand} href="/track" more={t.home.seeTrack}>
              {data.projects.map((project) => (
                <Row
                  key={project.id}
                  href={`/track/${project.id}`}
                  title={project.title}
                  meta={
                    project.client ||
                    t.home.aClient
                  }
                  right={t.home.doneOf
                    .replace("{done}", String(project.done))
                    .replace("{total}", String(project.total))}
                  note={
                    project.nextDueInDays === null
                      ? ""
                      : project.nextDueInDays < 0
                      ? t.home.lateBy.replace("{days}", String(Math.abs(project.nextDueInDays)))
                      : t.home.dueIn.replace("{days}", String(project.nextDueInDays))
                  }
                  alarm={project.nextDueInDays !== null && project.nextDueInDays < 0}
                />
              ))}
            </Section>
          )}

          {data.quotes.length > 0 && (
            <Section title={t.home.recentQuotes} href="/quote" more={t.home.seeQuotes}>
              {data.quotes.map((quote) => (
                <Row
                  key={quote.id}
                  href={`/quote/${quote.id}`}
                  title={quote.title}
                  meta={quote.client || t.home.aClient}
                  right={formatMoney(quote.price, quote.currency)}
                  note={
                    quote.unseenAcceptance
                      ? t.home.stateSigned
                      : quote.tracked
                      ? t.home.stateTracked
                      : quote.outcome === "WON"
                      ? t.home.stateWon
                      : quote.outcome === "LOST"
                      ? t.home.stateLost
                      : quote.published
                      ? t.home.statePublished
                      : t.home.stateDraft
                  }
                  alarm={quote.unseenAcceptance}
                />
              ))}
            </Section>
          )}

          {/* Patterns rather than events: the things that cost a freelancer
              money are invisible one quote at a time and obvious across ten.
              Every one names the figure it is measured against and when that
              figure was researched, because a flag saying "this is unusual"
              without saying unusual compared to what is an opinion with a
              number on it. */}
          {data.patterns.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-body font-bold text-body text-ink m-0">
                  {t.home.worthChanging}
                </h2>
                <Link href="/memory?tab=rules" className="text-meta font-semibold text-violet no-underline tap">
                  {t.home.yourRules}
                </Link>
              </div>

              {data.patterns.map((pattern) => (
                <div
                  key={pattern.key}
                  className={`rounded-card border-l-[3px] px-4 py-3.5 ${
                    pattern.tone === "urgent"
                      ? "bg-coral-tint border-coral"
                      : "bg-violet-tint border-violet"
                  }`}
                >
                  <h3 className="font-body font-bold text-small text-ink m-0 text-pretty">
                    {fill(t.home[pattern.observed as keyof typeof t.home], pattern.values)}
                  </h3>
                  <p className="text-caption text-slate mt-1.5 mb-0 max-w-prose text-pretty">
                    {fill(t.home[pattern.compared as keyof typeof t.home], pattern.values)}
                  </p>
                  {/* The change itself, with its numbers in the label. This
                      was a link reading "Your ground rules" whichever problem
                      it was, so it named neither the rule nor what to do
                      about it, and left the work where it started. */}
                  {pattern.fix && (
                    <div className="mt-2.5">
                      <button
                        type="button"
                        disabled={Boolean(fixing) || done.includes(pattern.key)}
                        onClick={() => void applyFix(pattern)}
                        className="font-body font-semibold text-caption text-white bg-violet border-none rounded-full px-3 py-1.5 cursor-pointer tap disabled:opacity-60"
                      >
                        {done.includes(pattern.key)
                          ? t.home.fixDone
                          : fill(
                              t.home[pattern.fix.label as keyof typeof t.home],
                              pattern.values
                            )}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {fixError && (
                <p className="font-body font-semibold text-caption text-overdue m-0">{fixError}</p>
              )}

              <p className="text-caption text-text-muted m-0 max-w-prose text-pretty">
                {t.home.patternSource}
                {data.researchedAt
                  ? ` ${t.home.patternResearched.replace(
                      "{when}",
                      new Date(data.researchedAt).toLocaleDateString()
                    )}`
                  : ""}
              </p>
              {data.sources.length > 0 && (
                <p className="text-caption text-text-muted m-0">
                  {t.home.patternSources}:{" "}
                  {data.sources.map((source, i) => (
                    <span key={source.url || i}>
                      {i > 0 ? ", " : ""}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate underline"
                      >
                        {source.title || source.url}
                      </a>
                    </span>
                  ))}
                </p>
              )}
            </div>
          )}

          {data.invoices.length > 0 && (
            <Section title={t.home.unpaid} href="/invoices" more={t.home.seeInvoices}>
              {data.invoices.map((invoice) => (
                <Row
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  title={t.home.invoiceNumber.replace(
                    "{number}",
                    String(invoice.number).padStart(4, "0")
                  )}
                  meta={invoice.client || t.home.aClient}
                  right={formatMoney(invoice.total, invoice.currency)}
                  note={
                    invoice.overdueDays > 0
                      ? t.home.lateBy.replace("{days}", String(invoice.overdueDays))
                      : t.home.dueIn.replace("{days}", String(Math.abs(invoice.overdueDays)))
                  }
                  alarm={invoice.overdueDays > 0}
                />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

/** One of the three numbers, and where it leads. */
function Figure({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note: string;
  href: string;
}) {
  return (
    <Link href={href} className="no-underline">
      <Card className="h-full">
        <div className="font-body font-bold text-caption uppercase tracking-[0.08em] text-slate">
          {label}
        </div>
        <div className="font-display italic text-[28px] leading-none text-ink mt-2">{value}</div>
        <div className="text-caption text-text-muted mt-1.5">{note}</div>
      </Card>
    </Link>
  );
}

function Section({
  title,
  href,
  more,
  children,
}: {
  title: string;
  href: string;
  more: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-body font-bold text-body text-ink m-0">{title}</h2>
        <Link href={href} className="text-meta font-semibold text-violet no-underline tap">
          {more}
        </Link>
      </div>
      <Card>
        <ul className="list-none p-0 m-0 flex flex-col">{children}</ul>
      </Card>
    </div>
  );
}

/**
 * One line in one of the lists.
 *
 * The same shape for a project, a quote and an invoice, because they are the
 * same question in three tenses and three different row designs would read as
 * three different products.
 */
function Row({
  href,
  title,
  meta,
  right,
  note,
  alarm,
}: {
  href: string;
  title: string;
  meta: string;
  right: string;
  note: string;
  alarm: boolean;
}) {
  return (
    <li className="border-b border-line/70 last:border-b-0">
      <Link
        href={href}
        className="flex items-center justify-between gap-3 py-3 no-underline tap-row"
      >
        <span className="min-w-0">
          <span className="block font-body font-semibold text-small text-ink truncate">
            {title}
          </span>
          <span className="block text-caption text-text-muted truncate">{meta}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-body font-semibold text-small text-ink tabular-nums">
            {right}
          </span>
          {note && (
            <span
              className={`block text-caption ${alarm ? "text-overdue font-semibold" : "text-text-muted"}`}
            >
              {note}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
