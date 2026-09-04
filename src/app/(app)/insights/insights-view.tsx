"use client";

import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/label";
import type { Funnel, Retention, DayCount } from "@/lib/metrics";
import type { Subscriber, SendRow, Account } from "@/lib/mailing";
import { MailingList } from "./mailing-list";
import { RoadmapCard } from "./roadmap-card";
import { TestingCard } from "./testing-card";
import { ReadingCard } from "./reading-card";
import { PageHeader } from "@/components/ui/page-header";

/**
 * The product's numbers, read rather than explored.
 *
 * No date pickers, no segment builder, no drill-down. A dashboard you have to
 * operate is one you stop opening, and the questions here are fixed: does a
 * quote get finished, does it reach a client, does a signed one get tracked,
 * does tracked work get invoiced. Four questions, one screen, no controls.
 *
 * Where a rate cannot be trusted it says so rather than showing a number.
 * "100%" off three quotes is worse than no figure, because it will be believed
 * and it will be wrong.
 */
export function InsightsView({
  windowDays,
  accounts,
  projects,
  active,
  funnel,
  rates,
  retention,
  quotesPerDay,
  kinds,
  empty,
  accountsTotal,
  subscribers,
  sends,
  everyone,
}: {
  windowDays: number;
  accounts: number;
  projects: number;
  active: number;
  funnel: Funnel;
  rates: {
    published: number | null;
    accepted: number | null;
    tracked: number | null;
    invoiced: number | null;
  };
  retention: Retention;
  quotesPerDay: DayCount[];
  kinds: { kind: string; count: number }[];
  empty: boolean;
  /** For the mailing list, which is about people rather than about use. */
  accountsTotal: number;
  subscribers: Subscriber[];
  sends: SendRow[];
  /** Every account, so the page answers "who is using this" as well as
   * "who agreed to hear from us". */
  everyone: Account[];
}) {
  const busiest = Math.max(1, ...quotesPerDay.map((d) => d.count));

  return (
    <>
      <Topbar />
      <PageHeader
        title="Insights"
        subtitle={`The last ${windowDays} days. Counts across every account, never one person.`}
      />

      {empty ? (
        <Card>
          <p className="text-small text-slate m-0">
            Nothing recorded yet. Events start from the next quote, invoice or signup.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-[14px]">
            <Figure label="Accounts" value={accounts} />
            <Figure label={`Active in ${windowDays} days`} value={active} />
            <Figure label="Projects tracked" value={projects} />
            <Figure label="Quotes made" value={funnel.generated} />
          </div>

          {/* The loop, in order, each step as a share of the one before it. A
              rate against the total would make later steps look broken when
              they are only downstream. */}
          <Card>
            <CardHeader title={<>From quote to invoice</>} hint={<>Each percentage is of the step above it.</>} />
            <div className="flex flex-col">
              <Step name="Quotes made" count={funnel.generated} share={null} of={funnel.generated} />
              <Step name="Sent to a client" count={funnel.published} share={rates.published} of={funnel.generated} />
              <Step name="Accepted" count={funnel.accepted} share={rates.accepted} of={funnel.generated} />
              <Step name="Tracked" count={funnel.tracked} share={rates.tracked} of={funnel.generated} />
              <Step name="Invoiced" count={funnel.invoiced} share={rates.invoiced} of={funnel.generated} />
            </div>
          </Card>

          <div className="flex flex-col lg:flex-row gap-5">
            <Card className="flex-1 min-w-0">
              <CardHeader title={<>New accounts</>} hint={<>Signing in is not using it, so activated means one real action.</>} />
              <div className="flex flex-col">
                <Step name="Signed up" count={retention.joined} share={null} of={retention.joined} />
                <Step
                  name="Did something"
                  count={retention.activated}
                  share={null}
                  of={retention.joined}
                />
                <Step
                  name="Came back for a second quote"
                  count={retention.returned}
                  share={null}
                  of={retention.joined}
                />
              </div>
            </Card>

            <Card className="flex-1 min-w-0">
              <CardHeader title={<>Quotes per day</>} hint={<>Last 14 days, quiet days included.</>} />
              {/* Bars rather than a line, because a line between two points
                  implies values in between that were never measured. */}
              <div className="flex items-end gap-1 h-24">
                {quotesPerDay.map((day) => (
                  <div key={day.day} className="flex-1 flex flex-col justify-end" title={`${day.day}: ${day.count}`}>
                    <div
                      className={`rounded-sm ${day.count > 0 ? "bg-violet" : "bg-line"}`}
                      style={{ height: `${Math.max(2, (day.count / busiest) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-caption text-text-muted mt-1.5">
                <span>{quotesPerDay[0]?.day.slice(5)}</span>
                <span>{quotesPerDay.at(-1)?.day.slice(5)}</span>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title={<>What gets used</>} hint={<>Every recorded event in the window, busiest first.</>} />
            <div className="flex flex-col">
              {kinds.map((row) => (
                <div
                  key={row.kind}
                  className="flex items-baseline justify-between gap-3 py-1.5 border-b border-line/70 last:border-b-0"
                >
                  <span className="text-small text-ink">{readable(row.kind)}</span>
                  <span className="text-small text-slate tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Outside the empty check. A brand new install has no events and can
          still have somebody who ticked the box on the signup form, and that
          is exactly when knowing is useful. */}
      {/* First, because it is the only thing on this page that is a decision
          rather than a number. */}
      <RoadmapCard />
      <ReadingCard />
      <TestingCard />
      <MailingList
        subscribers={subscribers}
        accounts={accountsTotal}
        sends={sends}
        everyone={everyone}
      />
    </>
  );
}

/** One headline number, in the inverted style the tracker uses. */
function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-ink rounded-card px-4 py-3.5 lg:px-5 min-w-0">
      <div className="font-label text-caption uppercase tracking-[0.09em] text-white/60">
        {label}
      </div>
      <div className="font-body font-bold text-title text-white tabular-nums mt-1 truncate">
        {value}
      </div>
    </div>
  );
}

/**
 * A step, with a bar showing it against the top of the funnel.
 *
 * The bar is always relative to the first step, so the shape of the drop-off is
 * visible at a glance; the percentage beside it is against the previous step,
 * which is the number that says whether this particular handover works.
 */
function Step({
  name,
  count,
  share,
  of,
}: {
  name: string;
  count: number;
  share: number | null;
  of: number;
}) {
  const width = of > 0 ? Math.round((count / of) * 100) : 0;
  return (
    <div className="py-2 border-b border-line/70 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-small text-ink">{name}</span>
        <span className="flex items-baseline gap-2 shrink-0">
          <span className="font-body font-semibold text-small text-ink tabular-nums">{count}</span>
          {share !== null && (
            <span className="text-caption text-text-muted tabular-nums">{share}%</span>
          )}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-line mt-1.5 overflow-hidden">
        <div className="h-full rounded-full bg-violet" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/** Event names as English rather than as identifiers. */
function readable(kind: string): string {
  return kind.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
