"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import type { ActionResult } from "@/actions/briefs";
import { cleanAnswers, WELCOME_QUESTIONS } from "@/lib/welcome-questions";
import { writeWelcomePack } from "@/lib/anthropic";
import { visitors } from "@/lib/portal-auth";
import { specFor } from "@/lib/onboarding-blocks";

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

/**
 * The answers behind the welcome pack.
 *
 * Kept separately from the prose so the questions can be re-opened and changed
 * later. A pack that only exists as a paragraph can be edited but not revised:
 * you cannot see what you said about revisions without reading the whole thing
 * and hoping it is in there.
 */
export async function setOnboardingAction(
  clientId: string,
  answers: Record<string, string>
): Promise<ActionResult<undefined>> {
  const client = await owned(clientId);
  if (!client) return { ok: false, error: "Client not found." };

  await clients().update({
    where: { id: client.id },
    data: { onboarding: cleanAnswers(answers) },
  });
  revalidatePath(`/clients/${client.id}`);
  return { ok: true, data: undefined };
}

/**
 * Turning the answers into something a person would actually read.
 *
 * Haiku, not Sonnet: this is a short rewrite of text somebody has already
 * written, which is exactly what the small model is for (see
 * docs/agents/efficiency-standards.md). It is also not on any critical path —
 * nothing is blocked on it, and the answers stay exactly as given if it fails,
 * so the worst case is the freelancer writing the paragraph themselves, which
 * is what they would have been doing anyway.
 *
 * It returns the draft rather than saving it. A machine deciding what your
 * client reads about how you work, without you seeing it first, is the wrong
 * shape for this whatever the output quality.
 */
export async function draftWelcomePackAction(
  clientId: string,
  answers: Record<string, string>
): Promise<ActionResult<{ text: string }>> {
  const client = await owned(clientId);
  if (!client) return { ok: false, error: "Client not found." };

  const cleaned = cleanAnswers(answers);
  if (Object.keys(cleaned).length === 0) {
    return { ok: false, error: "Answer a question or two first." };
  }

  try {
    const lines = WELCOME_QUESTIONS.filter((q) => cleaned[q.id]).map(
      (q) => `${q.ask} ${cleaned[q.id]}`
    );

    const text = await writeWelcomePack(lines);
    return { ok: true, data: { text } };
  } catch {
    return { ok: false, error: "Couldn't draft that. Your answers are saved." };
  }
}

/**
 * Who may read this client's portal.
 *
 * The portal is gated and access is by invitation, so this list is the whole
 * of it. Adding somebody creates the row that lets their address sign in;
 * removing it takes them out on every device at once, which is the thing an
 * unguessable link could never do.
 */
export async function inviteVisitorAction(
  clientId: string,
  email: string,
  name: string
): Promise<ActionResult<undefined>> {
  const client = await owned(clientId);
  if (!client) return { ok: false, error: "Client not found." };

  const cleaned = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) {
    return { ok: false, error: "That needs to be an email address." };
  }

  const existing = await visitors().findFirst({ where: { clientId, email: cleaned } });
  if (existing) return { ok: false, error: "They are already on the list." };

  await visitors().create({
    data: { clientId, email: cleaned, name: name.trim().slice(0, 80) },
  });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, data: undefined };
}

/** Taking somebody out. Immediate, and on every device they are signed in on. */
export async function removeVisitorAction(
  clientId: string,
  visitorId: string
): Promise<ActionResult<undefined>> {
  const client = await owned(clientId);
  if (!client) return { ok: false, error: "Client not found." };

  // Scoped to the client, so an id from elsewhere cannot be deleted through
  // a client you happen to own.
  const visitor = await visitors().findFirst({ where: { id: visitorId, clientId } });
  if (!visitor) return { ok: false, error: "Not found." };

  await visitors().delete({ where: { id: visitor.id } });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, data: undefined };
}

/** The list, for the panel on the client page. */
export async function visitorsForClient(clientId: string) {
  const rows = await visitors().findMany({
    where: { clientId },
    orderBy: { invitedAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    hasPassword: Boolean(row.passwordHash),
    verified: Boolean(row.verifiedAt),
    lastSeenAt: row.verifiedAt ? row.lastSeenAt.toISOString() : null,
  }));
}

/**
 * The blocks: what this client is told before the work starts.
 *
 * A row means "included". No row means "left out", which is a different thing
 * from included-and-empty: one is a decision and the other is an unfinished
 * job, and the interface can only tell them apart if the database does.
 */
function blocks() {
  return (
    prisma as unknown as {
      onboardingBlock: {
        findMany(args: {
          where: { clientId: string };
        }): Promise<{ id: string; kind: string; title: string; body: string }[]>;
        upsert(args: {
          where: { clientId_kind: { clientId: string; kind: string } };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }): Promise<unknown>;
        deleteMany(args: { where: { clientId: string; kind: string } }): Promise<unknown>;
      };
    }
  ).onboardingBlock;
}

export async function setBlockAction(
  clientId: string,
  kind: string,
  title: string,
  body: string
): Promise<ActionResult<undefined>> {
  const client = await owned(clientId);
  if (!client) return { ok: false, error: "Client not found." };

  const spec = specFor(kind);
  // Anything not in the catalogue is refused rather than stored: a kind the
  // portal will never render is a row somebody edits and cannot find.
  if (!spec) return { ok: false, error: "Not a thing we can say." };

  const cleanTitle = title.trim().slice(0, 60) || spec.title;
  const cleanBody = body.trim().slice(0, 2000);
  await blocks().upsert({
    where: { clientId_kind: { clientId, kind } },
    create: { clientId, kind, title: cleanTitle, body: cleanBody },
    update: { title: cleanTitle, body: cleanBody },
  });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, data: undefined };
}

/** Leaving one out. Deletes the row, so absent means absent. */
export async function removeBlockAction(
  clientId: string,
  kind: string
): Promise<ActionResult<undefined>> {
  const client = await owned(clientId);
  if (!client) return { ok: false, error: "Client not found." };

  await blocks().deleteMany({ where: { clientId, kind } });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, data: undefined };
}




/**
 * What this client's page shows.
 *
 * One action for every switch rather than one action each. They are the same
 * decision asked six times, and six near-identical exports is six places for
 * the ownership check to be got subtly wrong.
 *
 * The allowlist is what makes that safe: a key not on it is refused, so this
 * cannot be used to set an arbitrary column on a Client row.
 */
const SECTIONS = [
  "showProjects",
  "showQuotes",
  "showInvoices",
  "showTime",
  "showDocuments",
  "showUpdates",
] as const;

export type PortalSection = (typeof SECTIONS)[number];

export async function setSectionAction(
  clientId: string,
  section: string,
  on: boolean
): Promise<ActionResult<undefined>> {
  const client = await owned(clientId);
  if (!client) return { ok: false, error: "Client not found." };
  if (!SECTIONS.includes(section as PortalSection)) {
    return { ok: false, error: "Not a section." };
  }

  await clients().update({ where: { id: client.id }, data: { [section]: on } });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, data: undefined };
}

/** How much of the time travels: every entry with its note, or totals only. */
export async function setTimeDetailAction(
  clientId: string,
  detail: string
): Promise<ActionResult<undefined>> {
  const client = await owned(clientId);
  if (!client) return { ok: false, error: "Client not found." };
  if (detail !== "entries" && detail !== "totals") {
    return { ok: false, error: "Not a level of detail." };
  }

  await clients().update({ where: { id: client.id }, data: { timeDetail: detail } });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, data: undefined };
}
