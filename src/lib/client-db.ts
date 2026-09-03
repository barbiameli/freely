import { prisma } from "@/lib/prisma";
import { clientSlug, historyFrom, isRealName, NO_HISTORY, type ClientHistory } from "@/lib/clients";

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
      };
    }
  ).client;
}

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
    const [briefs, projects, invoices] = await Promise.all([
      prisma.brief.findMany({ where: { userId }, select: { id: true, client: true } }),
      prisma.project.findMany({ where: { userId }, select: { id: true, client: true } }),
      prisma.invoice.findMany({ where: { userId }, select: { id: true, clientName: true } }),
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
  userId: string,
  name: string
): Promise<ClientHistory> {
  const trimmed = name.trim();
  if (!isRealName(trimmed)) return NO_HISTORY;
  const slug = clientSlug(trimmed);

  try {
    const client = await table().findUnique({ where: { userId_slug: { userId, slug } } });
    if (!client) return NO_HISTORY;

    const [quotes, invoices] = await Promise.all([
      prisma.brief.findMany({
        where: { clientId: client.id } as unknown as { userId: string },
        select: { outcome: true, createdAt: true, acceptedAt: true },
      }),
      prisma.invoice.findMany({
        where: { clientId: client.id } as unknown as { userId: string },
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
