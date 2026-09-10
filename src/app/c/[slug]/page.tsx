import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Paperclip } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { dict } from "@/lib/i18n";
import { formatLongDay } from "@/lib/schedule";

/**
 * One client, one link, everything they need.
 *
 * The order is the order somebody arriving actually wants it in: what happens
 * next, then the work, then the files, then how to reach you. A person opening
 * this in week one is reading the welcome pack; the same person in week six is
 * looking for a project, which is why the projects sit above the documents
 * rather than under them.
 *
 * Read-only by construction. There is no form on this page and no action it
 * can call, so the whole question of what an unauthenticated visitor is
 * allowed to do has one answer: look.
 */

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({ params }: { params: { slug: string } }) {
  /*
   * Everything through a narrow shape: the portal columns and the document
   * relation are newer than the generated client here.
   */
  const db = prisma as unknown as {
    client: {
      findUnique(args: { where: { publicSlug: string } }): Promise<{
        id: string;
        userId: string;
        name: string;
        published: boolean;
        welcomePack: string | null;
      } | null>;
    };
    clientDocument: {
      findMany(args: {
        where: { clientId: string };
        orderBy: { createdAt: "asc" };
      }): Promise<
        { id: string; name: string; note: string; emoji: string; size: number }[]
      >;
    };
  };

  const client = await db.client.findUnique({ where: { publicSlug: params.slug } });
  // The same answer for a portal that does not exist and one that is switched
  // off. Telling those apart is a way of finding out that a client is real.
  if (!client || !client.published) notFound();

  const [owner, projects, documents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: client.userId },
      select: {
        name: true,
        studioName: true,
        brandPrimaryColor: true,
        brandLogoDataUrl: true,
      },
    }),
    // Narrow shape here too: clientId on Project is newer than the generated
    // client, so a named filter would not compile.
    (
      prisma as unknown as {
        project: {
          findMany(args: {
            where: Record<string, unknown>;
            include: Record<string, unknown>;
            orderBy: { createdAt: "desc" };
          }): Promise<
            {
              id: string;
              title: string;
              publicSlug: string;
              createdAt: Date;
              deliverables: { done: boolean }[];
            }[]
          >;
        };
      }
    ).project.findMany({
      where: { clientId: client.id, published: true },
      include: { deliverables: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    db.clientDocument.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const extras = owner as unknown as {
    bookingUrl?: string | null;
    clientNotes?: string | null;
  } | null;

  // The client's own pack if there is one, and what the account says
  // otherwise. Writing it once should cover everybody.
  const pack = client.welcomePack || extras?.clientNotes || "";
  const t = dict("en").clientPage;
  const primary = owner?.brandPrimaryColor || "#FF2D8A";
  const studio = owner?.studioName || owner?.name || "";

  return (
    <div className="min-h-screen bg-paper py-8 sm:py-12 px-5">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-card overflow-hidden">
          <div className="px-6 sm:px-8 py-7 flex flex-col gap-7">
            <div>
              {owner?.brandLogoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={owner.brandLogoDataUrl}
                  alt=""
                  className="h-8 w-auto mb-4"
                />
              )}
              <h1 className="font-display text-[30px] sm:text-[38px] leading-[1.02] text-ink m-0">
                {client.name}
              </h1>
              {studio && <p className="text-slate text-small mt-1.5 mb-0">{studio}</p>}
            </div>

            {pack && (
              <section>
                <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-2">
                  {t.welcomePack}
                </h2>
                {/* Their words, and the line breaks they typed. */}
                <p className="text-small text-slate leading-relaxed whitespace-pre-line m-0">
                  {pack}
                </p>
              </section>
            )}

            {projects.length > 0 && (
              <section>
                <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-2">
                  {t.projects}
                </h2>
                <ul className="list-none p-0 m-0">
                  {projects.map((project) => {
                    const done = project.deliverables.filter((d) => d.done).length;
                    const total = project.deliverables.length;
                    return (
                      <li key={project.id} className="border-b border-line last:border-b-0">
                        <Link
                          href={`/p/${project.publicSlug}`}
                          className="flex items-baseline justify-between gap-3 py-3 no-underline"
                        >
                          <span className="min-w-0">
                            <span className="block font-body font-semibold text-small text-ink truncate">
                              {project.title}
                            </span>
                            <span className="block text-caption text-text-muted">
                              {total > 0
                                ? t.stepsDone
                                    .replace("{done}", String(done))
                                    .replace("{total}", String(total))
                                : formatLongDay(new Date(project.createdAt), "en")}
                            </span>
                          </span>
                          {/* The bar, rather than a status word. "In progress"
                              is true of a job that is one step in and one step
                              from finished, and those are not the same news. */}
                          {total > 0 && (
                            <span className="w-20 h-1.5 rounded-full bg-paper overflow-hidden shrink-0">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${Math.max(4, (done / total) * 100)}%`,
                                  backgroundColor: primary,
                                }}
                              />
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {documents.length > 0 && (
              <section>
                <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-2">
                  {t.documents}
                </h2>
                <ul className="list-none p-0 m-0">
                  {documents.map((doc) => (
                    <li key={doc.id} className="border-b border-line last:border-b-0">
                      <a
                        href={`/c/${params.slug}/doc/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-baseline gap-3 py-2.5 no-underline"
                      >
                        <span className="shrink-0 w-5 text-center" aria-hidden>
                          {doc.emoji || <Paperclip size={13} className="text-text-muted inline" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-body font-semibold text-small text-ink truncate">
                            {doc.name}
                          </span>
                          {doc.note && (
                            <span className="block text-caption text-text-muted truncate">
                              {doc.note}
                            </span>
                          )}
                        </span>
                        <span className="font-label text-caption text-text-muted tabular-nums shrink-0">
                          {doc.size >= 1024 * 1024
                            ? `${(doc.size / 1024 / 1024).toFixed(1)} MB`
                            : `${Math.max(1, Math.round(doc.size / 1024))} KB`}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {extras?.bookingUrl && (
              <section className="border-t border-line pt-6">
                <a
                  href={extras.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-body font-bold text-sm rounded-full px-6 py-3 no-underline"
                  style={{ backgroundColor: primary, color: "#1A1626" }}
                >
                  <CalendarClock size={16} />
                  {t.bookACall}
                </a>
                <p className="text-caption text-text-muted mt-2 mb-0">{t.bookHint}</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Unlisted, the same as every other client-facing page here. */
export const metadata = { robots: { index: false, follow: false } };
