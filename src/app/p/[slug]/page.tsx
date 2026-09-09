import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dict, fill } from "@/lib/i18n";
import { recentlyDone, comingUp, type ClientDeliverable } from "@/lib/client-page";
import { ClientDeliverableRow } from "./client-sections";
import { statusLabel } from "@/lib/project-status";
import { formatLongDay } from "@/lib/schedule";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * What the client sees.
 *
 * This is the only page in the product a paying client actually reads, and it
 * was the least finished. It printed the database status ("Status: ACTIVE"),
 * showed one update and hid the rest, ran every entry through one unbroken
 * paragraph, and used the freelancer's brand colour on the title while leaving
 * everything else Freely violet.
 *
 * Now: the freelancer's colours throughout, the status in words, the whole
 * update history rather than the newest one, and a progress bar, because "four
 * of six done" is the question a client opens this page to answer.
 */
export default async function PublicProjectPage({ params }: { params: { slug: string } }) {
  const project = await prisma.project.findUnique({
    where: { publicSlug: params.slug },
    include: {
      deliverables: {
        orderBy: { order: "asc" },
        // The broken-down list, for the chevron and for working out what has
        // just been finished.
        include: { steps: { orderBy: { order: "asc" } } },
      },
      brief: true,
      user: {
        select: {
          brandPrimaryColor: true,
          brandAccentColor: true,
          brandLogoDataUrl: true,
          studioName: true,
          name: true,
        },
      },
    },
  });

  if (!project || !project.published) notFound();

  // The language of the quote this project came from, because the audience here
  // is the client, not the freelancer. Read through a cast for the same reason
  // the quote page does it: the column is newer than the generated client.
  const quoteLanguage =
    (project.brief as unknown as { language?: string } | null)?.language ?? "en";
  const t = dict(quoteLanguage);
  const q = t.publicPage;

  // Cast: this column is newer than the generated Prisma client here.
  const plainLanguage = Boolean(
    (project as unknown as { plainLanguage?: boolean }).plainLanguage
  );

  /*
   * The rest of what a client needs, read through a cast because these
   * columns and relations are newer than the generated client here.
   *
   * Only published quotes are listed. A draft is a number you have not
   * decided on yet, and this page is the one place it must not appear.
   */
  const owner = project.user as unknown as {
    bookingUrl?: string | null;
    clientNotes?: string | null;
  };
  /*
   * Fetched separately rather than through an include, because the relation
   * is newer than the generated client here and a named include will not
   * compile. Nullable throughout: a project written before clients existed
   * has the name as a string and nothing to hang a library off, and those
   * pages get no documents section rather than an empty one.
   */
  const clientId = (project as unknown as { clientId?: string | null }).clientId ?? null;
  const db = prisma as unknown as {
    clientDocument: {
      findMany(args: {
        where: { clientId: string };
        orderBy: { createdAt: "asc" };
      }): Promise<{ id: string; name: string; size: number; note: string }[]>;
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
  };

  const documents = clientId
    ? await db.clientDocument.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } })
    : [];
  // Published only. A draft is a number that has not been decided on yet, and
  // this page is the one place it must never appear.
  const otherQuotes = clientId
    ? await db.brief.findMany({
        where: { clientId, published: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  // The tracker's own rows, in the shape lib/client-page works in. The client
  // wording where the project is set to plain language, falling back to the
  // real name so a line that was never rewritten still appears.
  const deliverables: ClientDeliverable[] = project.deliverables.map((d) => {
    const row = d as unknown as {
      id: string;
      name: string;
      done: boolean;
      doneAt: Date | null;
      dueAt: Date | null;
      order: number;
      clientName?: string | null;
      steps?: { id: string; name: string; done: boolean; order: number }[];
    };
    return {
      id: row.id,
      name: (plainLanguage && row.clientName) || row.name,
      done: row.done,
      doneAt: row.doneAt ?? null,
      dueAt: row.dueAt ?? null,
      order: row.order,
      steps: row.steps ?? [],
    };
  });

  const justDone = recentlyDone(deliverables);
  const next = comingUp(deliverables);
  const schedule = project as unknown as { startDate: Date | null; dueDate: Date | null };

  const done = project.deliverables.filter((d) => d.done).length;
  const total = project.deliverables.length;
  const primary = project.user.brandPrimaryColor || "#F45B69";
  const accent = project.user.brandAccentColor || "#6320EE";
  const studio = project.user.studioName || project.user.name || "";
  const finished = project.status === "DONE";

  return (
    <div className="min-h-screen bg-paper py-8 px-5 sm:py-12">
      <div className="w-full max-w-2xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-6">
          {project.user.brandLogoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.user.brandLogoDataUrl} alt={studio} className="h-8" />
          ) : (
            <span className="font-display italic text-2xl" style={{ color: primary }}>
              {studio || "Freely"}
            </span>
          )}
          <span className="font-body text-caption uppercase tracking-wide text-text-muted">
            {q.projectUpdate}
          </span>
        </header>

        <div className="bg-white border border-line rounded-card shadow-panel overflow-hidden">
          {/* A band in the freelancer's own colour, so the page reads as theirs
              from the first glance rather than as a Freely page with their logo
              dropped on it. */}
          <div className="h-1.5" style={{ backgroundColor: primary }} />

          <div className="px-6 sm:px-8 py-7 flex flex-col gap-6">
            <div>
              <h1 className="font-display italic text-[28px] sm:text-3xl text-ink m-0 leading-tight">
                {project.title}
              </h1>
              <p className="text-slate text-small mt-1.5 mb-0">{project.client}</p>
            </div>

            {finished ? (
              <div
                className="rounded-lg px-4 py-3 font-body font-semibold text-small"
                style={{ backgroundColor: `${accent}14`, color: accent }}
              >
                {q.signedOff}
              </div>
            ) : (
              <div>
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <span className="font-body font-semibold text-small text-ink">
                    {statusLabel(project.status, t)}
                  </span>
                  {total > 0 && (
                    <span className="text-caption text-text-muted tabular-nums">
                      {fill(q.progress, { done, total })}
                    </span>
                  )}
                </div>
                {total > 0 && (
                  <div className="h-2 rounded-full bg-paper overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(4, (done / total) * 100)}%`,
                        backgroundColor: primary,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* The timeline, when there is one. Two dates rather than a
                graphic: a client wants to know when it started and when it is
                meant to be finished, and a bar with no labelled points on it
                answers neither. */}
            {(schedule.startDate || schedule.dueDate) && (
              <section className="flex flex-wrap gap-x-8 gap-y-3 border-y border-line py-3.5">
                {schedule.startDate && (
                  <div>
                    <div className="font-body text-caption uppercase tracking-wide text-text-muted">
                      {q.started}
                    </div>
                    <div className="font-body font-semibold text-small text-ink mt-0.5">
                      {formatLongDay(new Date(schedule.startDate), quoteLanguage)}
                    </div>
                  </div>
                )}
                {schedule.dueDate && (
                  <div>
                    <div className="font-body text-caption uppercase tracking-wide text-text-muted">
                      {q.due}
                    </div>
                    <div className="font-body font-semibold text-small text-ink mt-0.5">
                      {formatLongDay(new Date(schedule.dueDate), quoteLanguage)}
                    </div>
                  </div>
                )}
              </section>
            )}

            {total > 0 && (
              <section>
                <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-1">
                  {q.deliverables}
                </h2>
                <ul className="list-none p-0 m-0">
                  {deliverables.map((d) => (
                    <ClientDeliverableRow
                      key={d.id}
                      deliverable={d}
                      label={d.name}
                      primary={primary}
                      stepsLabel={q.stepsDone}
                    />
                  ))}
                </ul>
              </section>
            )}

            {/* What has just been finished, worked out from the work itself.
                It used to be whatever the freelancer had last written and sent,
                which made the page only as current as the last time somebody
                remembered to write one. */}
            <section>
              <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-3">
                {q.updates}
              </h2>
              {justDone.length === 0 ? (
                <p className="text-small text-text-muted m-0">{q.nothingYet}</p>
              ) : (
                <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
                  {justDone.map((line) => (
                    <li key={line.id} className="flex items-start gap-2.5">
                      <span
                        className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: primary }}
                      />
                      <span className="min-w-0">
                        <span className="block text-small text-ink leading-relaxed">
                          {line.text}
                        </span>
                        {line.under && (
                          <span className="block text-caption text-text-muted mt-0.5">
                            {line.under}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-3">
                {q.nextSteps}
              </h2>
              {next.length === 0 ? (
                <p className="text-small text-text-muted m-0">{q.allDone}</p>
              ) : (
                <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
                  {next.map((line) => (
                    <li key={line.id} className="flex items-start gap-2.5">
                      <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-line shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-small text-slate leading-relaxed">
                          {line.text}
                        </span>
                        {line.under && (
                          <span className="block text-caption text-text-muted mt-0.5">
                            {line.under}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/*
            Everything that is true for the whole engagement rather than for
            this week: how you work, what they have been sent, and a way to
            reach you. Under the progress rather than above it, because the
            question somebody opens this page to ask is how the work is going.
          */}
          {(owner.clientNotes || documents.length > 0 || otherQuotes.length > 0 || owner.bookingUrl) && (
            <div className="border-t border-line px-6 sm:px-8 py-7 flex flex-col gap-7">
              {owner.clientNotes && (
                <section>
                  <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-2">
                    {t.clientPage.howIWork}
                  </h2>
                  {/* Their words, and the line breaks they typed. */}
                  <p className="text-small text-slate leading-relaxed whitespace-pre-line m-0">
                    {owner.clientNotes}
                  </p>
                </section>
              )}

              {documents.length > 0 && (
                <section>
                  <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-2">
                    {t.clientPage.documents}
                  </h2>
                  <ul className="list-none p-0 m-0">
                    {documents.map((doc) => (
                      <li key={doc.id} className="border-b border-line last:border-b-0">
                        <a
                          href={`/p/${params.slug}/doc/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-baseline justify-between gap-3 py-2.5 no-underline"
                        >
                          <span className="min-w-0">
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

              {otherQuotes.length > 0 && (
                <section>
                  <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-2">
                    {t.clientPage.quotes}
                  </h2>
                  <ul className="list-none p-0 m-0">
                    {otherQuotes.map((quote) => (
                      <li key={quote.id} className="border-b border-line last:border-b-0">
                        <a
                          href={`/q/${quote.publicSlug}`}
                          className="flex items-baseline justify-between gap-3 py-2.5 no-underline"
                        >
                          <span className="min-w-0">
                            <span className="block font-body font-semibold text-small text-ink truncate">
                              {quote.title}
                            </span>
                            <span className="block text-caption text-text-muted">
                              {t.clientPage.quoteSent}{" "}
                              {formatLongDay(new Date(quote.createdAt), quoteLanguage)}
                            </span>
                          </span>
                          <span className="font-label text-small text-ink tabular-nums shrink-0">
                            {formatMoney(quote.price, quote.currency, quoteLanguage as "en" | "es")}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {owner.bookingUrl && (
                <section>
                  <a
                    href={owner.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block font-body font-bold text-sm rounded-full px-6 py-3 no-underline"
                    style={{ backgroundColor: primary, color: "#1A1626" }}
                  >
                    {t.clientPage.bookACall}
                  </a>
                  <p className="text-caption text-text-muted mt-2 mb-0">
                    {t.clientPage.bookHint}
                  </p>
                </section>
              )}
            </div>
          )}
        </div>

        {studio && (
          <p className="text-center text-caption text-text-muted mt-5 mb-0">{studio}</p>
        )}
      </div>
    </div>
  );
}
