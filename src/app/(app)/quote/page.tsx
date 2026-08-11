import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { hasOwnBranding } from "@/lib/branding";
import { quotesToAskAbout, type QuoteOutcome } from "@/lib/quote-outcome";
import { QuoteWizard } from "./quote-wizard";

/**
 * How many quotes the prompt will ask about at once.
 *
 * Somebody coming back after a fortnight away could have a dozen undecided
 * quotes, and a carousel of twelve is a chore rather than a nudge. The newest
 * few are also the ones whose answers are actually known.
 */
const MAX_IN_PROMPT = 5;

/** The columns the generated client here does know about. */
interface BriefRow {
  id: string;
  title: string;
  client: string;
  price: number;
  hours: number;
  currency: string | null;
  deliverables: unknown;
  status: string;
  published: boolean;
  createdAt: Date;
}

// Brief generation (invoked from this page via generateBriefAction) can
// involve a large uploaded source document plus a real Claude call —
// sometimes with web search on top. Route segment config like this is the
// correct place for it: `export const maxDuration` inside the Server Action
// file itself isn't allowed ("use server" files may only export async
// functions), so it belongs on the page that invokes the action instead.
export const maxDuration = 60;

export default async function QuotePage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const user = await requireFullUser();
  const scope = teamScopeWhere(user);
  // No select: the outcome and acceptance columns are newer than the generated
  // Prisma client here, and narrowing to the columns the stub knows about
  // would mean they came back undefined and the prompt never appeared.
  const briefs = (await prisma.brief.findMany({
    where: scope,
    // No limit: the All quotes tab is the full list now, so the page that
    // feeds it has to load the full list.
    orderBy: { createdAt: "desc" },
    include: { project: { select: { id: true } } },
  })) as unknown as (BriefRow & {
    outcome?: QuoteOutcome;
    acceptedAt?: Date | null;
    acceptedName?: string | null;
    acceptanceSeenAt?: Date | null;
    project?: { id: string } | null;
  })[];

  const now = new Date();
  const dismissedAt = (user as unknown as { quotePromptDismissedAt?: Date | null })
    .quotePromptDismissedAt;

  const toAskAbout = quotesToAskAbout(
    briefs.map((b) => ({
      id: b.id,
      title: b.title,
      client: b.client,
      price: b.price,
      currency: b.currency,
      createdAt: b.createdAt,
      outcome: b.outcome ?? "PENDING",
      acceptedAt: b.acceptedAt ?? null,
      tracked: b.status === "TRACKED",
    })),
    now,
    dismissedAt
  ).slice(0, MAX_IN_PROMPT);

  // Signed but not yet told about. The banner says each one once.
  const signed = briefs
    .filter((b) => b.acceptedAt && !b.acceptanceSeenAt)
    .map((b) => ({
      briefId: b.id,
      title: b.title,
      client: b.acceptedName || b.client,
      projectId: b.project?.id ?? null,
    }));

  return (
    <QuoteWizard
      signed={signed}
      landedQuotes={toAskAbout.map((q) => ({
        id: q.id,
        title: q.title,
        client: q.client,
        price: q.price,
        currency: q.currency,
      }))}
      initialTab={searchParams?.tab === "all" ? "all" : "new"}
      recentBriefs={briefs.map((b) => ({
        id: b.id,
        title: b.title,
        client: b.client,
        price: b.price,
        hours: b.hours,
        currency: b.currency,
        deliverables: (b.deliverables as string[]) ?? [],
        status: b.status as "DRAFT" | "TRACKED",
        published: b.published,
        createdAt: b.createdAt.toISOString(),
      }))}
      userCurrency={user.currency}
      hasBrand={hasOwnBranding(user)}
      savedLocation={(user as unknown as { location: string | null }).location ?? ""}
      savedRate={(user as unknown as { defaultRate: number | null }).defaultRate ?? 0}
      savedRateUnit={
        (user as unknown as { defaultRateUnit: string | null }).defaultRateUnit ?? "HOUR"
      }
    />
  );
}
