"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import type { ActionResult } from "@/actions/briefs";

/**
 * The client's own front door.
 *
 * A portal per client rather than a page per project. Everything a client
 * needs that is true for the whole relationship lives in one place with one
 * link: the welcome pack, the files, and every project you have run for them.
 * Before this, a client with three jobs had three links and three copies of
 * the same brand guide, and no answer to "where do I find that thing you sent
 * me in March".
 */

interface ClientRow {
  id: string;
  publicSlug: string;
  published: boolean;
  welcomePack: string | null;
}

/** The narrow shape again: these columns are newer than the generated client. */
function clients() {
  return (
    prisma as unknown as {
      client: {
        findFirst(args: { where: Record<string, unknown> }): Promise<ClientRow | null>;
        update(args: {
          where: { id: string };
          data: Record<string, unknown>;
        }): Promise<ClientRow>;
      };
    }
  ).client;
}

async function owned(clientId: string) {
  const user = await requireFullUser();
  return clients().findFirst({ where: { id: clientId, ...teamScopeWhere(user) } });
}

/**
 * What happens next, in your words.
 *
 * Empty means "use what the account says", rather than "say nothing". One
 * client who needs the process explained differently should not mean writing
 * it out again for everybody else.
 */
export async function setWelcomePackAction(
  clientId: string,
  welcomePack: string
): Promise<ActionResult<undefined>> {
  const client = await owned(clientId);
  if (!client) return { ok: false, error: "Client not found." };

  await clients().update({
    where: { id: client.id },
    data: { welcomePack: welcomePack.trim().slice(0, 6000) || null },
  });
  revalidatePath(`/clients/${client.id}`);
  return { ok: true, data: undefined };
}

/**
 * Turning the portal on, and off.
 *
 * Off is a real off switch rather than a hidden link: the portal stops
 * resolving, and so does every document reachable through it, for everybody
 * already holding the address. That is the whole reason the blob store is
 * private.
 */
export async function setPortalPublishedAction(
  clientId: string,
  published: boolean
): Promise<ActionResult<{ slug: string }>> {
  const client = await owned(clientId);
  if (!client) return { ok: false, error: "Client not found." };

  await clients().update({ where: { id: client.id }, data: { published } });
  revalidatePath(`/clients/${client.id}`);
  return { ok: true, data: { slug: client.publicSlug } };
}
