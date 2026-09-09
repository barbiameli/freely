import { prisma } from "@/lib/prisma";
import { documentResponse } from "@/lib/document-stream";

/**
 * A document, to a client, with no account.
 *
 * The permission is the project page itself: you may read this file if you
 * have the unguessable slug of a project that is still published, and the
 * file belongs to that project's client. Both halves matter. The slug alone
 * would let one client of yours read another's files by swapping the document
 * id, and the document id alone would be a public URL again.
 *
 * That is also the off switch. Unpublish the project and every document on it
 * stops resolving for everyone holding the link, which is the whole reason
 * the store is private rather than public.
 */
export async function GET(
  _request: Request,
  { params }: { params: { slug: string; docId: string } }
) {
  const project = await prisma.project.findUnique({
    where: { publicSlug: params.slug },
  });
  if (!project || !project.published) {
    return new Response("Not found", { status: 404 });
  }

  const clientId = (project as unknown as { clientId?: string | null }).clientId ?? null;
  if (!clientId) return new Response("Not found", { status: 404 });

  // Narrow shape: the model is newer than the generated client here.
  const doc = await (
    prisma as unknown as {
      clientDocument: {
        findFirst(args: {
          where: { id: string; clientId: string };
        }): Promise<{ pathname: string; name: string; contentType: string } | null>;
      };
    }
  ).clientDocument.findFirst({ where: { id: params.docId, clientId } });

  // The same 404 for a document that does not exist and one belonging to
  // somebody else. Telling those apart is a way of asking whether a given id
  // is real.
  if (!doc) return new Response("Not found", { status: 404 });

  return documentResponse(doc);
}
