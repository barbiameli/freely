import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { documentResponse } from "@/lib/document-stream";

/**
 * The same document, to the person who uploaded it.
 *
 * Separate from the client route because the check is different: this one is
 * a signed-in session and team scope, and it works whether or not any project
 * is published. Without it you could not open your own file until you had
 * published a project to show it on, which is backwards.
 */
export async function GET(
  _request: Request,
  { params }: { params: { docId: string } }
) {
  let user;
  try {
    user = await requireFullUser();
  } catch {
    return new Response("Not found", { status: 404 });
  }

  // Narrow shape: both models are newer than the generated client here.
  const db = prisma as unknown as {
    clientDocument: {
      findFirst(args: {
        where: { id: string };
      }): Promise<{
        clientId: string;
        pathname: string;
        name: string;
        contentType: string;
      } | null>;
    };
    client: {
      findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
    };
  };

  const doc = await db.clientDocument.findFirst({ where: { id: params.docId } });
  if (!doc) return new Response("Not found", { status: 404 });

  const owned = await db.client.findFirst({
    where: { id: doc.clientId, ...teamScopeWhere(user) },
  });
  // Not 403. A different answer for a document that exists but is somebody
  // else's is a way of finding out that it exists.
  if (!owned) return new Response("Not found", { status: 404 });

  return documentResponse(doc);
}
