import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { invoiceTotals } from "@/lib/money";
import type { InvoiceLineItem } from "@/lib/invoice-pdf";
import { resolveExpertise } from "@/lib/quote-defaults";
import { patternsFor, type QuoteFact, type InvoiceFact } from "@/lib/quote-patterns";
import type { Benchmark } from "@/lib/benchmarks";
import { needsAction, watchStages } from "@/lib/stage-watch";
import { parseRuleSettings, ruleValues } from "@/lib/ground-rules";
import { HomeView, type HomeData } from "./home-view";

/** A stage, as the include above returns it. */
interface WatchedMilestone {
  id: string;
  name: string;
  amount: number;
  invoicedAt: Date | null;
  deliverables: { done: boolean; doneAt: Date | null }[];
}

/** The benchmark row, as the newer-than-the-client cast returns it. */
interface BenchmarkRow {
  industry: string;
  country: string;
  level: string;
  rateLow: number;
  rateHigh: number;
  currency: string;
  rateUnit: string;
  revisionRounds: number | null;
  depositPercent: number | null;
  paymentDays: number | null;
  acceptanceDays: number | null;
  callsIncluded: number | null;
  note: string;
  sources: unknown;
  refreshedAt: Date;
}

/**
 * The first thing you see, instead of a blank quote form.
 *
 * Signing in used to land on the wizard, which assumes the reason somebody
 * opened Freely is to write a new quote. Most of the time it is not: it is to
 * find out whether the last one was answered, whether an invoice was paid, or
 * what is due this week. A form cannot answer any of that, and the work
 * already in flight was two clicks away in three different places.
 *
 * Everything here is read from what exists rather than stored: there is no
 * dashboard state to keep in step, and a page that derives its own numbers
 * cannot show a stale one.
 */
export default async function HomePage() {
  const user = await requireFullUser();
  const scope = teamScopeWhere(user);

  const level = resolveExpertise(
    (user as unknown as { expertiseLevel?: string | null }).expertiseLevel,
    (user as unknown as { inferredExpertise?: string | null }).inferredExpertise
  );

  const [briefs, projects, invoices, quoteHistory, invoiceHistory, benchmark] = await Promise.all([
    prisma.brief.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        client: true,
        price: true,
        currency: true,
        published: true,
        status: true,
        outcome: true,
        acceptedAt: true,
        acceptanceSeenAt: true,
        createdAt: true,
      },
    }),
    prisma.project.findMany({
      where: { ...scope, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        deliverables: { select: { id: true, done: true, dueAt: true } },
        // The stages, with when each piece of them landed and whether it has
        // been billed. This is what lets the acceptance clause actually run.
        milestones: {
          orderBy: { order: "asc" },
          include: {
            deliverables: { select: { done: true, doneAt: true } },
          },
        },
      },
    }),
    prisma.invoice.findMany({
      where: { userId: user.id, paid: false },
      orderBy: { dueAt: "asc" },
      take: 6,
      select: {
        id: true,
        number: true,
        clientName: true,
        currency: true,
        taxRate: true,
        lineItems: true,
        dueAt: true,
      },
    }),
    // A wider window than the lists above, because a pattern needs a run of
    // quotes rather than the last handful. Twenty is enough to see a habit and
    // recent enough that it is still the habit.
    prisma.brief.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { issuedAt: "desc" },
      take: 20,
      select: {
        id: true,
        currency: true,
        taxRate: true,
        lineItems: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
      },
    }),
    // What freelancers in the same field, country and level actually do. A
    // cron keeps this fresh; a miss simply means no comparisons today rather
    // than a page that waits on a web search.
    (prisma as unknown as {
      benchmark: {
        findUnique(args: {
          where: {
            industry_country_level: { industry: string; country: string; level: string };
          };
        }): Promise<BenchmarkRow | null>;
      };
    }).benchmark.findUnique({
      where: {
        industry_country_level: {
          industry: user.industry ?? "",
          country: (user as unknown as { country?: string | null }).country || "??",
          level,
        },
      },
    }),
  ]);

  const now = Date.now();

  const facts: QuoteFact[] = quoteHistory.map((brief) => {
    const settings = (brief.settings as Record<string, unknown> | null) ?? {};
    const extras = (brief.extras as { assumptions?: unknown[]; paymentTerms?: string } | null) ?? {};
    const hidden = ((brief as unknown as { hiddenSections?: string[] }).hiddenSections ?? []) as string[];
    return {
      id: brief.id,
      published: brief.published,
      outcome: brief.outcome,
      price: brief.price,
      hours: brief.hours,
      rate: brief.hourlyRate ?? null,
      currency: brief.currency,
      paymentPlan: typeof settings.paymentPlan === "string" ? settings.paymentPlan : "SPLIT",
      upfrontPercent: typeof settings.upfrontPercent === "number" ? settings.upfrontPercent : 50,
      // Removed counts as absent: a section the freelancer took off the quote
      // never reached the client.
      hasAssumptions: Boolean(
        (extras.assumptions?.length ?? 0) > 0 && !hidden.includes("assumptions")
      ),
      hasPaymentTerms: Boolean(extras.paymentTerms && !hidden.includes("paymentTerms")),
      createdAt: brief.createdAt.toISOString(),
      acceptedAt: brief.acceptedAt?.toISOString() ?? null,
    };
  });

  const invoiceFacts: InvoiceFact[] = invoiceHistory.map((invoice) => {
    const lines = (invoice.lineItems as unknown as InvoiceLineItem[]) ?? [];
    const { total } = invoiceTotals(
      lines.map((line) => line.amount ?? 0),
      invoice.taxRate,
      invoice.currency
    );
    return {
      id: invoice.id,
      total,
      currency: invoice.currency ?? "USD",
      issuedAt: invoice.issuedAt.toISOString(),
      dueAt: invoice.dueAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString() ?? null,
    };
  });

  const reference: Benchmark | null = benchmark
    ? {
        industry: benchmark.industry,
        country: benchmark.country,
        level: benchmark.level,
        rateLow: benchmark.rateLow,
        rateHigh: benchmark.rateHigh,
        currency: benchmark.currency,
        rateUnit: benchmark.rateUnit === "DAY" ? "DAY" : "HOUR",
        revisionRounds: benchmark.revisionRounds,
        depositPercent: benchmark.depositPercent,
        paymentDays: benchmark.paymentDays,
        acceptanceDays: benchmark.acceptanceDays,
        callsIncluded: benchmark.callsIncluded,
        note: benchmark.note,
        sources: Array.isArray(benchmark.sources)
          ? (benchmark.sources as { title?: string; url?: string }[]).map((source) => ({
              title: source.title ?? "",
              url: source.url ?? "",
            }))
          : [],
        refreshedAt: benchmark.refreshedAt.toISOString(),
      }
    : null;

  /**
   * The clauses, running.
   *
   * The quote says delivered work with no response after so many business days
   * counts as accepted and is invoiced. Until this, nothing watched for that
   * happening and the sentence sat on the document while somebody waited.
   */
  const ruleWindows = ruleValues(
    parseRuleSettings((user as unknown as { groundRules?: unknown }).groundRules)
  );
  const watched = needsAction(
    watchStages(
      projects.flatMap((project) =>
        (project as unknown as { milestones?: WatchedMilestone[] }).milestones?.map(
          (milestone) => ({
            id: milestone.id,
            projectId: project.id,
            projectTitle: project.title,
            client: project.client,
            name: milestone.name,
            amount: milestone.amount,
            currency: project.currency,
            invoicedAt: milestone.invoicedAt?.toISOString() ?? null,
            deliverables: milestone.deliverables.map((d) => ({
              done: d.done,
              doneAt: d.doneAt?.toISOString() ?? null,
            })),
          })
        ) ?? []
      ),
      {
        acceptanceDays: ruleWindows.acceptanceDays,
        feedbackDays: ruleWindows.feedbackDays,
      }
    )
  );

  const data: HomeData = {
    // needsAction has already dropped the ones still inside their window,
    // so the narrower type here is the honest one.
    stages: watched.map((watch) => ({
      kind: watch.kind as "deemedAccepted" | "feedbackOverdue",
      projectId: watch.stage.projectId,
      projectTitle: watch.stage.projectTitle,
      client: watch.stage.client,
      name: watch.stage.name,
      amount: watch.stage.amount,
      currency: watch.stage.currency,
      businessDays: watch.businessDays,
    })),
    // Capped at two. A page that names three things you are doing wrong every
    // morning is a page you scroll past.
    patterns: patternsFor(facts, invoiceFacts, reference).slice(0, 2),
    researchedAt: reference?.refreshedAt ?? null,
    sources: reference?.sources ?? [],
    quotes: briefs.map((brief) => ({
      id: brief.id,
      title: brief.title,
      client: brief.client,
      price: brief.price,
      currency: brief.currency,
      published: brief.published,
      tracked: brief.status === "TRACKED",
      outcome: brief.outcome,
      // An acceptance nobody has seen yet is the single most important thing
      // on this page, so it is computed here rather than left to the view.
      unseenAcceptance: Boolean(brief.acceptedAt && !brief.acceptanceSeenAt),
      // Days since it went out, for the ones still waiting on an answer.
      waitingDays: brief.published
        ? Math.floor((now - brief.createdAt.getTime()) / 86_400_000)
        : null,
      createdAt: brief.createdAt.toISOString(),
    })),
    projects: projects.map((project) => ({
      id: project.id,
      title: project.title,
      client: project.client,
      price: project.price,
      currency: project.currency,
      done: project.deliverables.filter((d) => d.done).length,
      total: project.deliverables.length,
      // The nearest thing still to do that has a date on it. Overdue work
      // sorts to the front by being negative.
      nextDueInDays: project.deliverables
        .filter((d) => !d.done && d.dueAt)
        .map((d) => Math.floor((d.dueAt!.getTime() - now) / 86_400_000))
        .sort((a, b) => a - b)[0] ?? null,
    })),
    invoices: invoices.map((invoice) => {
      const lines = (invoice.lineItems as unknown as InvoiceLineItem[]) ?? [];
      const { total } = invoiceTotals(
        lines.map((line) => line.amount ?? 0),
        invoice.taxRate,
        invoice.currency
      );
      return {
        id: invoice.id,
        number: invoice.number,
        client: invoice.clientName,
        total,
        currency: invoice.currency,
        overdueDays: Math.floor((now - invoice.dueAt.getTime()) / 86_400_000),
      };
    }),
  };

  return <HomeView data={data} name={user.name ?? ""} />;
}
