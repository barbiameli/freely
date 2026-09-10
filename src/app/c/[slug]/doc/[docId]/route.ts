import { prisma } from "@/lib/prisma";
import { documentResponse } from "@/lib/document-stream";

/**
 * A document, reached through the client's own portal.
 *
 * The sibling of the project route, and the same shape of check: you may read
 * this file if you hold the unguessable slug of a portal that is switched on,
 * and the file belongs to that portal's client. The document id alone proves
 * nothing, which is what stops one client reading another's files by editing
 * the address.
 */
export async function GET(
  _request: Request,
  { params }: { params: { slug: string; docId: string } }
) {
  const db = prisma as unknown as {
    client: {
      findUnique(args: {
        where: { publicSlug: string };
      }): Promise<{ id: string; published: boolean } | null>;
    };
    clientDocument: {
      findFirst(args: {
        where: { id: string; clientId: string };
      }): Promise<{ pathname: string; name: string; contentType: string } | null>;
    };
  };

  const client = await db.client.findUnique({ where: { publicSlug: params.slug } });
  if (!client || !client.published) return new Response("Not found", { status: 404 });

  const doc = await db.clientDocument.findFirst({
    where: { id: params.docId, clientId: client.id },
  });
  // One answer for missing and for not-yours.
  if (!doc) return new Response("Not found", { status: 404 });

  return documentResponse(doc);
}
