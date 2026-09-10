import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setVisitorCookie } from "@/lib/portal-session";

/**
 * The click on the link in the email.
 *
 * Spends the token, marks the visitor verified, and remembers them on this
 * device. Everything is one-shot: a token that has been used, or has expired,
 * is treated as though it never existed.
 *
 * It always ends on the portal, whether the token worked or not. A page saying
 * "that link has expired" would be honest and would also be a page nobody can
 * do anything with, when the portal itself is one press away and will simply
 * ask again.
 */
export async function GET(
  _request: Request,
  { params }: { params: { slug: string; token: string } }
) {
  const db = prisma as unknown as {
    portalToken: {
      findUnique(args: { where: { token: string } }): Promise<{
        id: string;
        visitorId: string;
        expiresAt: Date;
        usedAt: Date | null;
      } | null>;
      update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    };
    portalVisitor: {
      findUnique(args: {
        where: { id: string };
      }): Promise<{ id: string; clientId: string } | null>;
      update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    };
    client: {
      findUnique(args: {
        where: { publicSlug: string };
      }): Promise<{ id: string; published: boolean } | null>;
    };
  };

  const token = await db.portalToken.findUnique({ where: { token: params.token } });
  const live = token && !token.usedAt && token.expiresAt > new Date();

  if (live) {
    const visitor = await db.portalVisitor.findUnique({ where: { id: token.visitorId } });
    const client = await db.client.findUnique({ where: { publicSlug: params.slug } });

    /*
     * The token has to belong to this portal.
     *
     * Without this, a token issued for one client's portal would sign you in
     * on another, since the visitor id is all the cookie carries and the slug
     * comes from the URL somebody typed.
     */
    if (visitor && client && client.published && visitor.clientId === client.id) {
      await db.portalToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
      await db.portalVisitor.update({
        where: { id: visitor.id },
        data: { verifiedAt: new Date(), lastSeenAt: new Date() },
      });
      setVisitorCookie(params.slug, visitor.id);
    }
  }

  redirect(`/c/${params.slug}`);
}
