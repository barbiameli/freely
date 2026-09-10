"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import type { ActionResult } from "@/actions/briefs";

/**
 * The files on a client's page.
 *
 * Uploaded by you and read by them, which is the whole permission model: the
 * public page has no way to write, so there is nothing on it to abuse.
 *
 * The store is private, so no blob here has a URL that resolves from the
 * internet. The bytes come out through a route that has checked who is
 * asking: the owner while signed in, or a client on a project page that is
 * still published. Unpublish the project and the documents stop resolving,
 * which is the part a public URL could never do, because a link that is
 * already in somebody\'s inbox cannot be taken back.
 *
 * `addRandomSuffix` stays anyway. Two clients called Acme would otherwise
 * collide on brand-guide.pdf and the second upload would overwrite the first.
 */

/** Ten megabytes. Big enough for a brand guide, small enough not to be a bill. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * What a client page is for.
 *
 * An allowlist rather than a blocklist. The blobs are served from a domain
 * under the account, so an uploaded .html or .svg is a page that runs script
 * on that origin, and the point of the list is that neither of those can be
 * uploaded by accident.
 */
const ALLOWED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
];

interface DocumentRow {
  id: string;
  clientId: string;
  name: string;
  pathname: string;
  contentType: string;
  size: number;
  note: string;
  emoji: string;
  order: number;
  createdAt: Date;
}

/**
 * Reaching the ClientDocument table.
 *
 * Through a narrow shape rather than by name: the model is newer than the
 * generated client in some environments and a named call would not compile
 * there. Same pattern as the client and waitlist reads.
 */
function table() {
  return (
    prisma as unknown as {
      clientDocument: {
        findMany(args: {
          where: { clientId: string };
          orderBy: { order: "asc" }[] | { createdAt: "asc" };
        }): Promise<DocumentRow[]>;
        findFirst(args: { where: { id: string } }): Promise<DocumentRow | null>;
        create(args: { data: Record<string, unknown> }): Promise<DocumentRow>;
        update(args: {
          where: { id: string };
          data: Record<string, unknown>;
        }): Promise<DocumentRow>;
        delete(args: { where: { id: string } }): Promise<DocumentRow>;
        count(args: { where: { clientId: string } }): Promise<number>;
      };
    }
  ).clientDocument;
}

/** The client, if it is yours. Every action here starts with this. */
async function ownedClient(clientId: string) {
  const user = await requireFullUser();
  // Same narrow shape as the table above, and for the same reason.
  const clients = (
    prisma as unknown as {
      client: {
        findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
      };
    }
  ).client;
  return clients.findFirst({ where: { id: clientId, ...teamScopeWhere(user) } });
}

export async function documentsForClient(clientId: string): Promise<DocumentRow[]> {
  return table().findMany({ where: { clientId }, orderBy: { createdAt: "asc" } });
}

export async function uploadDocumentAction(
  clientId: string,
  form: FormData
): Promise<ActionResult<undefined>> {
  try {
    const client = await ownedClient(clientId);
    if (!client) return { ok: false, error: "Client not found." };

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Pick a file first." };
    }
    if (file.size > MAX_BYTES) {
      return {
        ok: false,
        error: `That file is ${Math.round(file.size / 1024 / 1024)} MB. The limit is 10 MB.`,
      };
    }
    if (!ALLOWED.includes(file.type)) {
      return {
        ok: false,
        error: "That kind of file can't go on a client page. Documents, images and archives can.",
      };
    }

    const blob = await put(`clients/${clientId}/${file.name}`, file, {
      access: "private",
      addRandomSuffix: true,
    });

    await table().create({
      data: {
        clientId,
        name: file.name,
        pathname: blob.pathname,
        contentType: file.type,
        size: file.size,
        order: await table().count({ where: { clientId } }),
      },
    });

    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    /*
     * Say which thing broke.
     *
     * This was a bare catch returning one sentence about file storage, which
     * is the commonest cause and useless when it is not the cause: a missing
     * token, a store that is not linked to the project, and a database column
     * that has not been pushed yet all produced the same words and none of
     * them said what to do.
     */
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[documents] upload failed:", detail);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return {
        ok: false,
        error:
          "File storage isn't connected. Create a Blob store in Vercel, link it to this project, then run: npx vercel env pull .env.local",
      };
    }
    if (/pathname|column|relation|does not exist/i.test(detail)) {
      return { ok: false, error: "The database is behind. Run: npx prisma db push" };
    }
    return { ok: false, error: `That didn't upload. ${detail}` };
  }
}

/**
 * A small set, and only this set.
 *
 * Free text here would be a text field somebody pastes a sentence into, and
 * the column is one character wide by design. These are the kinds of thing a
 * freelancer actually sends a client.
 */
export const DOCUMENT_EMOJI = [
  "",
  "\u{1F4C4}",
  "\u{1F3A8}",
  "\u{1F5BC}\uFE0F",
  "\u{1F4CA}",
  "\u{1F4DD}",
  "\u{1F510}",
  "\u{1F4C1}",
  "\u{2705}",
  "\u{1F680}",
  "\u{2728}",
  "\u{1F4CE}",
];

export async function renameDocumentAction(
  id: string,
  name: string,
  note: string,
  emoji: string
): Promise<ActionResult<undefined>> {
  try {
    const row = await table().findFirst({ where: { id } });
    if (!row || !(await ownedClient(row.clientId))) {
      return { ok: false, error: "Document not found." };
    }
    const cleaned = name.trim();
    if (!cleaned) return { ok: false, error: "Give it a name." };

    await table().update({
      where: { id },
      data: {
        name: cleaned.slice(0, 120),
        note: note.trim().slice(0, 300),
        // Anything not on the list becomes nothing, rather than being stored
        // and rendered as whatever it happens to be.
        emoji: DOCUMENT_EMOJI.includes(emoji) ? emoji : "",
      },
    });
    revalidatePath(`/clients/${row.clientId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "That didn't save." };
  }
}

export async function deleteDocumentAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const row = await table().findFirst({ where: { id } });
    if (!row || !(await ownedClient(row.clientId))) {
      return { ok: false, error: "Document not found." };
    }

    /*
     * The blob first, then the row.
     *
     * This order is deliberate. If the blob delete fails the row survives and
     * the file is still listed, which is recoverable by pressing delete again.
     * The other way round leaves bytes in the store that nothing in the app
     * knows about and nothing can ever reach to remove.
     */
    await del(row.pathname);
    await table().delete({ where: { id } });

    revalidatePath(`/clients/${row.clientId}`);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "That didn't delete. Try again in a moment." };
  }
}
