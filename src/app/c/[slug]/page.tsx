import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, FileText, Paperclip, Receipt, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { dict } from "@/lib/i18n";
import { formatLongDay } from "@/lib/schedule";
import { formatMoney } from "@/lib/money";
import { visitorIdFromCookie } from "@/lib/portal-session";
import { HelloBanner } from "@/components/portal/hello-banner";
import { PortalIntro } from "@/components/portal/portal-intro";
import { cleanAnswers } from "@/lib/welcome-questions";

/**
 * The client's dashboard.
 *
 * It began as a single narrow column, which is what a page holding a welcome
 * note and three files should be. It now holds projects, quotes, invoices and
 * a way to book time, and four sections stacked in a 640px column is a scroll
 * rather than a dashboard: the point of a dashboard is that the answer to
 * "where are we" is visible without moving.
 *
 * So: full width, a rail of sections, and one section at a time. The rail is
 * links rather than a tab component, which keeps the page itself a server
 * component: no form, no action, no client boundary.
 *
 * There is exactly one interactive thing on it, HelloBanner, and it can do
 * exactly one thing: ask for a link to be emailed to an address. Everything
 * else an unknown visitor can do here is look. That is a property of this
 * file rather than a promise, and there is a test that keeps it one.
 *
 * Money is on it. A client is the person paying, and an invoice they cannot
 * find is a payment that arrives late for a reason nobody meant. There is no
 * draft state on an Invoice in this app: the row is written when the invoice
 * is raised, so everything here has already been raised.
 */

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

type View = "overview" | "projects" | "quotes" | "invoices" | "meetings";

export default async function ClientPortalPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { view?: string };
}) {
  /*
   * Everything through a narrow shape: these columns and relations are newer
   * than the generated client in some environments.
   */
  const db = prisma as unknown as {
    client: {
      findUnique(args: { where: { publicSlug: string } }): Promise<{
        id: string;
        userId: string;
        name: string;
        published: boolean;
        welcomePack: string | null;
        onboarding: unknown;
      } | null>;
    };
    clientDocument: {
      findMany(args: {
        where: { clientId: string };
        orderBy: { createdAt: "asc" };
      }): Promise<{ id: string; name: string; note: string; emoji: string; size: number }[]>;
    };
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
    brief: {
      findMany(args: {
        where: Record<string, unknown>;
        orderBy: { createdAt: "desc" };
      }): Promise<
        {
          id: string;
          title: string;
          price: number;
          currency: string;
          publicSlug: string | null;
          createdAt: Date;
        }[]
      >;
    };
    invoice: {
      findMany(args: {
        where: Record<string, unknown>;
        orderBy: { issuedAt: "desc" };
      }): Promise<
        {
          id: string;
          number: number;
          issuedAt: Date;
          dueAt: Date | null;
          paid: boolean;
          currency: string;
          lineItems: unknown;
          taxRate: number;
        }[]
      >;
    };
  };

  const client = await db.client.findUnique({ where: { publicSlug: params.slug } });
  // The same answer for a portal that does not exist and one that is switched
  // off. Telling those apart is a way of finding out that a client is real.
  if (!client || !client.published) notFound();

  const [owner, projects, quotes, invoices, documents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: client.userId },
      select: { name: true, studioName: true, brandPrimaryColor: true, brandLogoDataUrl: true },
    }),
    db.project.findMany({
      where: { clientId: client.id, published: true },
      include: { deliverables: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    // Published only. A draft is a number nobody has decided on yet, and this
    // page is the one place it must never appear.
    db.brief.findMany({
      where: { clientId: client.id, published: true },
      orderBy: { createdAt: "desc" },
    }),
    db.invoice.findMany({ where: { clientId: client.id }, orderBy: { issuedAt: "desc" } }),
    db.clientDocument.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const extras = owner as unknown as {
    bookingUrl?: string | null;
    clientNotes?: string | null;
  } | null;

  const t = dict("en").clientPage;
  const primary = owner?.brandPrimaryColor || "#FF2D8A";
  const studio = owner?.studioName || owner?.name || "";
  const pack = client.welcomePack || extras?.clientNotes || "";
  const view = (searchParams?.view ?? "overview") as View;

  /*
   * Who is reading, if they have said.
   *
   * The cookie is checked against a real row rather than trusted on its own:
   * a signature proves the id was issued here, not that it still means
   * anything. A visitor whose row was deleted is nobody again.
   */
  const visitorId = visitorIdFromCookie(params.slug);
  const visitor = visitorId
    ? await (
        prisma as unknown as {
          portalVisitor: {
            findFirst(args: {
              where: { id: string; clientId: string };
            }): Promise<{ id: string; name: string; onboardingSeenAt: Date | null } | null>;
          };
        }
      ).portalVisitor.findFirst({ where: { id: visitorId, clientId: client.id } })
    : null;

  if (visitor) {
    // The thing the freelancer actually wanted out of all this: who opened it,
    // and when. Fire and forget, because a failed write here should not cost
    // somebody their page.
    void (
      prisma as unknown as {
        portalVisitor: {
          update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
        };
      }
    ).portalVisitor
      .update({ where: { id: visitor.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  /** An invoice's total, added up the way the document adds it up. */
  const totalOf = (invoice: { lineItems: unknown; taxRate: number }) => {
    const lines = Array.isArray(invoice.lineItems)
      ? (invoice.lineItems as { amount?: number }[])
      : [];
    const net = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
    return net + net * (invoice.taxRate / 100);
  };

  const tabs: { id: View; label: string; icon: typeof FileText; count?: number }[] = [
    { id: "overview", label: t.overview, icon: Sparkles },
    { id: "projects", label: t.projects, icon: FileText, count: projects.length },
    { id: "quotes", label: t.quotes, icon: FileText, count: quotes.length },
    { id: "invoices", label: t.invoices, icon: Receipt, count: invoices.length },
    ...(extras?.bookingUrl
      ? [{ id: "meetings" as View, label: t.meetings, icon: CalendarClock }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-white border-b border-line">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              {owner?.brandLogoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={owner.brandLogoDataUrl} alt="" className="h-7 w-auto mb-3" />
              )}
              <h1 className="font-display text-[26px] sm:text-[34px] leading-[1.05] text-ink m-0">
                {client.name}
              </h1>
              {studio && <p className="text-slate text-small mt-1 mb-0">{studio}</p>}
            </div>
            {extras?.bookingUrl && (
              <a
                href={extras.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-body font-bold text-sm rounded-full px-5 py-3 no-underline shrink-0"
                style={{ backgroundColor: primary, color: "#1A1626" }}
              >
                <CalendarClock size={16} />
                {t.bookACall}
              </a>
            )}
          </div>

          {/* Links rather than a tab control, so this page keeps having no
              JavaScript of its own. */}
          <nav className="flex gap-1 mt-5 -mb-5 overflow-x-auto">
            {tabs.map((tab) => {
              const active = tab.id === view;
              return (
                <Link
                  key={tab.id}
                  href={tab.id === "overview" ? `/c/${params.slug}` : `/c/${params.slug}?view=${tab.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 px-3.5 py-2.5 no-underline whitespace-nowrap border-b-2 font-body text-small ${
                    active
                      ? "border-ink font-bold text-ink"
                      : "border-transparent font-medium text-text-muted"
                  }`}
                >
                  <tab.icon size={14} aria-hidden />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="font-label text-caption text-text-muted tabular-nums">
                      {tab.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-7 flex flex-col gap-5">
        {view === "overview" && (
          <>
            {/* Only if we do not already know them. */}
            {!visitor && <HelloBanner slug={params.slug} />}
            <PortalIntro
              slug={params.slug}
              pack={pack}
              answers={cleanAnswers(client.onboarding)}
              // Somebody we do not know is shown it, every time, because there
              // is nowhere to record that they have read it. That is the
              // honest behaviour rather than a guess.
              seen={Boolean(visitor?.onboardingSeenAt)}
            />

            {documents.length > 0 && (
              <Panel title={t.documents}>
                <DocumentList documents={documents} slug={params.slug} />
              </Panel>
            )}
          </>
        )}

        {view === "projects" && (
          <Panel title={t.projects}>
            {projects.length === 0 ? (
              <Empty label={t.noProjects} />
            ) : (
              <ul className="list-none p-0 m-0">
                {projects.map((project) => {
                  const done = project.deliverables.filter((d) => d.done).length;
                  const total = project.deliverables.length;
                  return (
                    <li key={project.id} className="border-b border-line last:border-b-0">
                      <Link
                        href={`/p/${project.publicSlug}`}
                        className="flex items-center justify-between gap-4 py-3.5 no-underline"
                      >
                        <span className="min-w-0">
                          <span className="block font-body font-semibold text-body text-ink truncate">
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
                        {/* A bar rather than a status word. "In progress" is
                            true of a job one step in and one step from done,
                            and those are not the same news. */}
                        {total > 0 && (
                          <span className="w-28 h-1.5 rounded-full bg-paper overflow-hidden shrink-0">
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
            )}
          </Panel>
        )}

        {view === "quotes" && (
          <Panel title={t.quotes}>
            {quotes.length === 0 ? (
              <Empty label={t.noQuotes} />
            ) : (
              <ul className="list-none p-0 m-0">
                {quotes.map((quote) => (
                  <li key={quote.id} className="border-b border-line last:border-b-0">
                    <a
                      href={`/q/${quote.publicSlug}`}
                      className="flex items-center justify-between gap-4 py-3.5 no-underline"
                    >
                      <span className="min-w-0">
                        <span className="block font-body font-semibold text-body text-ink truncate">
                          {quote.title}
                        </span>
                        <span className="block text-caption text-text-muted">
                          {t.quoteSent} {formatLongDay(new Date(quote.createdAt), "en")}
                        </span>
                      </span>
                      <span className="font-label text-body text-ink tabular-nums shrink-0">
                        {formatMoney(quote.price, quote.currency, "en")}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {view === "invoices" && (
          <Panel title={t.invoices}>
            {invoices.length === 0 ? (
              <Empty label={t.noInvoices} />
            ) : (
              <ul className="list-none p-0 m-0">
                {invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between gap-4 py-3.5 border-b border-line last:border-b-0"
                  >
                    <span className="min-w-0">
                      <span className="block font-body font-semibold text-body text-ink">
                        {t.invoiceNumber.replace("{n}", String(invoice.number))}
                      </span>
                      <span className="block text-caption text-text-muted">
                        {invoice.dueAt
                          ? t.invoiceDue.replace(
                              "{date}",
                              formatLongDay(new Date(invoice.dueAt), "en")
                            )
                          : formatLongDay(new Date(invoice.issuedAt), "en")}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      {/* Lime behind ink for paid, which is the one thing the
                          palette lets lime say. */}
                      <span
                        className={`font-label text-caption rounded-full px-2.5 py-1 ${
                          invoice.paid ? "bg-mint-solid text-ink" : "bg-paper text-slate"
                        }`}
                      >
                        {invoice.paid ? t.invoicePaid : t.invoiceOutstanding}
                      </span>
                      <span className="font-label text-body text-ink tabular-nums">
                        {formatMoney(totalOf(invoice), invoice.currency, "en")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {view === "meetings" && extras?.bookingUrl && (
          <Panel title={t.meetings}>
            <p className="text-body text-slate m-0 mb-4 max-w-prose">{t.bookHint}</p>
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
          </Panel>
        )}
      </main>
    </div>
  );
}

/** One card, matching the app's own. */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-card border border-line shadow-card px-5 sm:px-7 py-6">
      <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-3.5">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-small text-text-muted m-0">{label}</p>;
}

function DocumentList({
  documents,
  slug,
}: {
  documents: { id: string; name: string; note: string; emoji: string; size: number }[];
  slug: string;
}) {
  return (
    <ul className="list-none p-0 m-0">
      {documents.map((doc) => (
        <li key={doc.id} className="border-b border-line last:border-b-0">
          <a
            href={`/c/${slug}/doc/${doc.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 py-3 no-underline"
          >
            <span className="shrink-0 w-6 text-center text-body" aria-hidden>
              {doc.emoji || <Paperclip size={14} className="text-text-muted inline" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-body font-semibold text-small text-ink truncate">
                {doc.name}
              </span>
              {doc.note && (
                <span className="block text-caption text-text-muted truncate">{doc.note}</span>
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
  );
}
