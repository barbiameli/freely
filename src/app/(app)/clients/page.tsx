import Link from "next/link";
import { requireFullUser } from "@/lib/session";
import { clientsForUser } from "@/lib/client-db";
import { Card } from "@/components/ui/card";
import { RecordHeader } from "@/components/ui/page-header";
import { serverDict } from "@/lib/i18n/server";

/**
 * Everybody this studio has worked with.
 *
 * The Client record has existed for a while and had no page: it was created
 * as a side effect of saving a quote, used to work out how well somebody knows
 * a client, and never shown. So the app knew Beyond Data had sent three
 * quotes and paid late twice, and the only way to find that out was to write
 * them a fourth quote and read the flags.
 */
export default async function ClientsPage() {
  const t = await serverDict();
  const user = await requireFullUser();
  const clients = await clientsForUser(user);

  return (
    <>
      <RecordHeader title={t.clients.title} meta={t.clients.subtitle} />

      {clients.length === 0 ? (
        <Card>
          <p className="text-small text-slate m-0">{t.clients.empty}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`} className="no-underline">
              <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer">
                <div className="min-w-0">
                  <div className="font-body font-bold text-lead text-ink truncate">
                    {client.name}
                  </div>
                  {client.email && (
                    <div className="text-meta text-text-muted truncate">{client.email}</div>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0 text-caption text-slate tabular-nums">
                  <span>{t.clients.quotesCount.replace("{n}", String(client.quotes))}</span>
                  <span>{t.clients.projectsCount.replace("{n}", String(client.projects))}</span>
                  <span>{t.clients.invoicesCount.replace("{n}", String(client.invoices))}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
