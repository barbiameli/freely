import { prisma } from "@/lib/prisma";
import { clientSlug, historyFrom, isRealName, NO_HISTORY, type ClientHistory } from "@/lib/clients";
import { teamScopeWhere } from "@/lib/team-scope";

/**
 * Reaching the Client table.
 *
 * Through a narrow shape rather than by name, because the model is newer than
 * the generated client in some environments and a named call would not compile
 * there. The same pattern as the benchmark reads. Contained here so nothing
 * else has to know.
 */
interface ClientRow {
  id: string;
  name: string;
  slug: string;
  email: string;
  notes: string;
  createdAt: Date;
}

function table() {
  return (
    prisma as unknown as {
      client: {
        findUnique(args: {
          where: { userId_slug: { userId: string; slug: string } };
        }): Promise<ClientRow | null>;
        create(args: { data: Record<string, unknown> }): Promise<ClientRow>;
        update(args: {
          where: { id: string };
          data: Record<string, unknown>;
        }): Promise<ClientRow>;
        findMany(args: {
          where: Record<string, unknown>;
          orderBy?: Record<string, unknown>;
        }): Promise<ClientRow[]>;
        findFirst(args: { where: Record<string, unknown> }): Promise<ClientRow | null>;
      };
    }
  ).client;
}

/**
 * How far back the first-time relink looks.
 *
 * Large enough that a normal account is covered whole, small enough that it
 * cannot become three unbounded reads on the path of saving a quote.
 */
const BACKFILL_WINDOW = 500;

/**
 * The client for this name, created if there is not one yet.
 *
 * Called on the way to saving a quote, so the record appears as a side effect
 * of work somebody was doing anyway. Returns nothing for the stand-in names a
 * brief without a client produces, since collecting every anonymous quote
 * under one imaginary client would be worse than not collecting them.
 *
 * Also relinks the rows that were written before this existed: the first time
 * a client is created, anything of theirs already in the database is joined to
 * it by name. So the history is right from the first quote rather than
 * starting empty for everybody.
 */
export async function clientFor(userId: string, name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!isRealName(trimmed)) return null;

  const slug = clientSlug(trimmed);
  const existing = await table().findUnique({ where: { userId_slug: { userId, slug } } });
  if (existing) {
    // Keep the spelling they used most recently, since that is the one they
    // will recognise.
    if (existing.name !== trimmed) {
      await table().update({ where: { id: existing.id }, data: { name: trimmed } });
    }
    return existing.id;
  }

  const created = await table().create({ data: { userId, name: trimmed, slug } });
  await backfill(userId, created.id, slug);
  return created.id;
}

/**
 * Joining up what was already there.
 *
 * Matching on the stored strings, in the database rather than in memory, and
 * only for rows that have no client yet. Failure is swallowed: a quote must
 * not fail to save because an old invoice could not be relinked.
 */
async function backfill(userId: string, clientId: string, slug: string): Promise<void> {
  try {
    /**
     * Bounded, and recent first.
     *
     * This ran on the path of saving a quote and read every brief, project and
     * invoice on the account to match by name in memory. Fine at twenty
     * quotes and three unbounded queries at two thousand. The names people
     * still quote are recent ones, so the window is where the matches are.
     */
    const take = BACKFILL_WINDOW;
    const [briefs, projects, invoices] = await Promise.all([
      prisma.brief.findMany({
        where: { userId },
        select: { id: true, client: true },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.project.findMany({
        where: { userId },
        select: { id: true, client: true },
        orderBy: { createdAt: "desc" },
        take,
      }),
      prisma.invoice.findMany({
        where: { userId },
        select: { id: true, clientName: true },
        orderBy: { issuedAt: "desc" },
        take,
      }),
    ]);

    const briefIds = briefs.filter((b) => clientSlug(b.client) === slug).map((b) => b.id);
    const projectIds = projects.filter((p) => clientSlug(p.client) === slug).map((p) => p.id);
    const invoiceIds = invoices.filter((i) => clientSlug(i.clientName) === slug).map((i) => i.id);

    const data = { clientId } as unknown as Record<string, never>;
    await Promise.all([
      briefIds.length
        ? prisma.brief.updateMany({ where: { id: { in: briefIds } }, data })
        : Promise.resolve(),
      projectIds.length
        ? prisma.project.updateMany({ where: { id: { in: projectIds } }, data })
        : Promise.resolve(),
      invoiceIds.length
        ? prisma.invoice.updateMany({ where: { id: { in: invoiceIds } }, data })
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("[clients] could not relink existing rows", err);
  }
}

/** What has happened with this client, read from their own rows. */
export async function historyForClient(
  user: { id: string; teamId: string | null },
  name: string
): Promise<ClientHistory> {
  const userId = user.id;
  const trimmed = name.trim();
  if (!isRealName(trimmed)) return NO_HISTORY;
  const slug = clientSlug(trimmed);

  try {
    const client = await table().findUnique({ where: { userId_slug: { userId, slug } } });
    if (!client) return NO_HISTORY;

    /**
     * Everything the studio has done with them, not just this person.
     *
     * Every other read in the app goes through teamScopeWhere, and this did
     * not, so on a team account two people quoting the same client each built
     * a separate history and the protection level was computed from half the
     * facts.
     */
    const scope = teamScopeWhere(user);
    const [quotes, invoices] = await Promise.all([
      prisma.brief.findMany({
        where: { ...scope, clientId: client.id } as unknown as { userId: string },
        select: { outcome: true, createdAt: true, acceptedAt: true },
      }),
      prisma.invoice.findMany({
        where: { ...scope, clientId: client.id } as unknown as { userId: string },
        select: { dueAt: true, paidAt: true },
      }),
    ]);
    return historyFrom(quotes, invoices);
  } catch (err) {
    // A history nobody could read is not a reason to stop somebody quoting.
    console.error("[clients] could not read history", err);
    return NO_HISTORY;
  }
}

/** A client with enough on it to draw a row in a list. */
export interface ClientSummary {
  id: string;
  name: string;
  email: string;
  quotes: number;
  projects: number;
  invoices: number;
  /** The most recent thing that happened, for sorting and for saying "since". */
  lastAt: Date | null;
}

/**
 * Everybody this studio has worked with, most recent first.
 *
 * Team-scoped like everything else: on a team account a client belongs to the
 * studio rather than to whoever happened to write the first quote.
 */
export async function clientsForUser(user: {
  id: string;
  teamId: string | null;
}): Promise<ClientSummary[]> {
  try {
    const rows = await table().findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    if (rows.length === 0) return [];

    const scope = teamScopeWhere(user);
    const ids = rows.map((row) => row.id);
    type Linked = { clientId: string | null; createdAt: Date };
    type LinkedInvoice = { clientId: string | null; issuedAt: Date };
    const [briefs, projects, invoices] = (await Promise.all([
      prisma.brief.findMany({
        where: { ...scope, clientId: { in: ids } } as unknown as { userId: string },
      }),
      prisma.project.findMany({
        where: { ...scope, clientId: { in: ids } } as unknown as { userId: string },
      }),
      prisma.invoice.findMany({
        where: { ...scope, clientId: { in: ids } } as unknown as { userId: string },
      }),
    ])) as unknown as [Linked[], Linked[], LinkedInvoice[]];

    const count = (list: { clientId: string | null }[], id: string) =>
      list.filter((row) => row.clientId === id).length;
    const latest = (dates: (Date | null)[]) =>
      dates.reduce<Date | null>(
        (most, date) => (date && (!most || date > most) ? date : most),
        null
      );

    return rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        quotes: count(briefs, row.id),
        projects: count(projects, row.id),
        invoices: count(invoices, row.id),
        lastAt: latest([
          ...briefs.filter((b) => b.clientId === row.id).map((b) => b.createdAt),
          ...projects.filter((p) => p.clientId === row.id).map((p) => p.createdAt),
          ...invoices.filter((i) => i.clientId === row.id).map((i) => i.issuedAt),
        ]),
      }))
      // Most recently active first: a list of clients is read to find the one
      // you are thinking about, and that is almost always a recent one.
      .sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0));
  } catch (err) {
    console.error("[clients] could not list", err);
    return [];
  }
}

/** One client, with everything of theirs, for their own page. */
export async function clientDetail(
  user: { id: string; teamId: string | null },
  clientId: string
) {
  const client = await table().findFirst({ where: { id: clientId, userId: user.id } });
  if (!client) return null;

  const scope = teamScopeWhere(user);
  const where = { ...scope, clientId: client.id } as unknown as { userId: string };
  type QuoteRow = {
    id: string;
    title: string;
    price: number;
    currency: string | null;
    createdAt: Date;
    outcome: string;
  };
  type ProjectRow = {
    id: string;
    title: string;
    status: string;
    price: number;
    currency: string | null;
  };
  type InvoiceRow = {
    id: string;
    number: number;
    issuedAt: Date;
    dueAt: Date | null;
    paidAt: Date | null;
    currency: string;
    lineItems: unknown;
  };
  const [quotes, projects, invoices] = (await Promise.all([
    prisma.brief.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.project.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.invoice.findMany({ where, orderBy: { issuedAt: "desc" } }),
  ])) as unknown as [QuoteRow[], ProjectRow[], InvoiceRow[]];

  return {
    /*
     * The portal columns come through too.
     *
     * This used to rebuild a fresh four-field object, so anything read off it
     * elsewhere by a cast was silently undefined: the client page asked for
     * publicSlug and got nothing, which made the copy button offer a link to
     * /c/undefined. A cast can only lie about a shape that is there.
     */
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      notes: client.notes,
      publicSlug: (client as unknown as { publicSlug?: string }).publicSlug ?? "",
      published: Boolean((client as unknown as { published?: boolean }).published),
      welcomePack: (client as unknown as { welcomePack?: string | null }).welcomePack ?? null,
    },
    quotes,
    projects,
    invoices,
    history: historyFrom(
      quotes.map((q) => ({
        outcome: q.outcome as string,
        createdAt: q.createdAt,
        acceptedAt: null,
      })),
      invoices.map((i) => ({ dueAt: i.dueAt, paidAt: i.paidAt }))
    ),
  };
}
