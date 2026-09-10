import { notFound } from "next/navigation";
import Link from "next/link";
import { requireFullUser } from "@/lib/session";
import { clientDetail } from "@/lib/client-db";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RecordHeader } from "@/components/ui/page-header";
import { StatRow } from "@/components/track/stat-row";
import { serverDict } from "@/lib/i18n/server";
import { currencySymbol } from "@/lib/currencies";
import { readHistory } from "@/lib/client-read";
import { documentsForClient } from "@/actions/documents";
import { DocumentsPanel } from "@/components/clients/documents-panel";
import { PortalPanel } from "@/components/clients/portal-panel";
import { UpdatesPanel } from "@/components/clients/updates-panel";
import { prisma } from "@/lib/prisma";

/**
 * One client, and what working with them has actually been like.
 *
 * The figures first, because they are facts and everything else on this page
 * is an inference from them. "Pays 6 days late" is checkable; "ask for money
 * up front" is a judgement, and somebody deciding whether to trust it needs to
 * see what it rests on.
 */
export default async function ClientPage({ params }: { params: { clientId: string } }) {
  const t = await serverDict();
  const user = await requireFullUser();
  const detail = await clientDetail(user, params.clientId);
  if (!detail) notFound();

  const { client, quotes, projects, invoices, history } = detail;
  const won = quotes.filter((q) => q.outcome === "WON").length;

  // What they can see on the page you send them, edited from the same screen
  // as everything else you know about them.
  const documents = await documentsForClient(client.id);

  /*
   * The updates, per project, newest project first.
   *
   * Fetched here rather than in clientDetail because it is the only screen
   * that wants them, and a client with a long history would otherwise carry
   * every entry ever written into every read of this record.
   */
  const entries = await prisma.diaryEntry.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    orderBy: { createdAt: "desc" },
  });



  return (
    <>
      <RecordHeader title={client.name} meta={client.email || t.clients.noEmail} />

      {/* Above the figures. What working with somebody has been like is
          reference; the page you send them is the thing you came here to do
          something about. */}
      <PortalPanel
        clientId={client.id}
        clientName={client.name}
        publicSlug={client.publicSlug}
        published={client.published}
        welcomePack={client.welcomePack}
        fallbackPack={
          (user as unknown as { clientNotes?: string | null }).clientNotes ?? null
        }
      />

      <StatRow
        stats={[
          { label: t.clients.quotes, value: String(history.quotes) },
          { label: t.clients.won, value: String(won) },
          {
            label: t.clients.answersIn,
            value:
              history.typicalAnswerDays === null
                ? "-"
                : t.clients.days.replace("{n}", String(history.typicalAnswerDays)),
          },
          {
            label: t.clients.paysIn,
            value:
              history.typicalPaymentDays === null
                ? "-"
                : t.clients.days.replace("{n}", String(history.typicalPaymentDays)),
            alert: (history.typicalPaymentDays ?? 0) > 0,
          },
          {
            label: t.clients.overdue,
            value: String(history.overdueInvoices),
            alert: history.overdueInvoices > 0,
          },
        ]}
      />

      {/* The inference, directly under the facts it rests on. Somebody
          deciding whether to trust "ask for a deposit" needs to see the
          "pays 6 days late" it came from. */}
      <Card tone="quiet">
        <Label>{t.clients.readTitle}</Label>
        <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-1.5">
          {readHistory(history).map((key) => (
            <li key={key} className="text-small text-slate text-pretty">
              {key === "new"
                ? t.clients.readNew
                : key === "reliable"
                  ? t.clients.readReliable
                  : key === "slow"
                    ? t.clients.readSlow
                    : key === "overdue"
                      ? t.clients.readOverdue
                      : key === "decisive"
                        ? t.clients.readDecisive
                        : key === "quiet"
                          ? t.clients.readQuiet
                          : t.clients.readLosing}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card>
          <Label>{t.clients.projects}</Label>
          {projects.length === 0 ? (
            <p className="text-caption text-text-muted mt-2 mb-0">{t.clients.noneYet}</p>
          ) : (
            <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/track/${project.id}`}
                    className="flex items-baseline justify-between gap-3 no-underline"
                  >
                    <span className="text-small text-ink truncate">{project.title}</span>
                    <span className="text-caption text-text-muted shrink-0 tabular-nums">
                      {currencySymbol(project.currency)}
                      {project.price.toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <Label>{t.clients.quotes}</Label>
          {quotes.length === 0 ? (
            <p className="text-caption text-text-muted mt-2 mb-0">{t.clients.noneYet}</p>
          ) : (
            <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-2">
              {quotes.map((quote) => (
                <li key={quote.id}>
                  <Link
                    href={`/quote/${quote.id}`}
                    className="flex items-baseline justify-between gap-3 no-underline"
                  >
                    <span className="text-small text-ink truncate">{quote.title}</span>
                    <span className="text-caption text-text-muted shrink-0 tabular-nums">
                      {currencySymbol(quote.currency)}
                      {quote.price.toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <Label>{t.clients.invoices}</Label>
          {invoices.length === 0 ? (
            <p className="text-caption text-text-muted mt-2 mb-0">{t.clients.noneYet}</p>
          ) : (
            <ul className="list-none p-0 m-0 mt-2 flex flex-col gap-2">
              {invoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="flex items-baseline justify-between gap-3 no-underline"
                  >
                    <span className="text-small text-ink">
                      #{String(invoice.number).padStart(4, "0")}
                    </span>
                    <span className="text-caption text-text-muted shrink-0">
                      {invoice.paidAt ? t.clients.paid : t.clients.unpaid}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <UpdatesPanel
        projects={projects.map((project) => ({
          id: project.id,
          title: project.title,
          published: Boolean(
            (project as unknown as { published?: boolean }).published
          ),
          entries: entries
            .filter((entry) => entry.projectId === project.id)
            .map((entry) => ({
              id: entry.id,
              body: entry.body,
              createdAt: entry.createdAt.toISOString(),
            })),
        }))}
      />

      <DocumentsPanel
        clientId={client.id}
        documents={documents.map((doc) => ({
          id: doc.id,
          name: doc.name,
          contentType: doc.contentType,
          size: doc.size,
          note: doc.note,
          emoji: doc.emoji,
        }))}
      />

    </>
  );
}
