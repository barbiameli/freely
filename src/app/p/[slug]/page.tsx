import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dict, fill } from "@/lib/i18n";
import { statusLabel } from "@/lib/project-status";
import { UpdateBody } from "@/components/update-body";
import { formatLongDay } from "@/lib/schedule";

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
      deliverables: { orderBy: { order: "asc" } },
      diaryEntries: { orderBy: { date: "desc" } },
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

            {total > 0 && (
              <section>
                <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-3">
                  {q.deliverables}
                </h2>
                <ul className="list-none p-0 m-0 flex flex-col gap-2">
                  {project.deliverables.map((d) => (
                    <li key={d.id} className="flex items-start gap-2.5">
                      <span
                        className="mt-[3px] w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[10px] text-white"
                        style={{ backgroundColor: d.done ? primary : "#E8EAEF" }}
                      >
                        {d.done ? "✓" : ""}
                      </span>
                      {/* The plain version when the project is set to it, the
                          tracker's own wording when it is not. Falls back to
                          the name either way, so a line that was never
                          rewritten still appears rather than vanishing. */}
                      <span
                        className={`text-small leading-relaxed ${
                          d.done ? "text-text-muted line-through" : "text-slate"
                        }`}
                      >
                        {plainLanguage
                          ? (d as unknown as { clientName?: string | null }).clientName ||
                            d.name
                          : d.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {project.diaryEntries.length > 0 && (
              <section>
                <h2 className="font-body font-bold text-caption uppercase tracking-wide text-text-muted m-0 mb-3">
                  {q.updates}
                </h2>
                <div className="flex flex-col">
                  {project.diaryEntries.map((entry, i) => (
                    <article
                      key={entry.id}
                      className={`flex gap-3 py-3.5 ${
                        i < project.diaryEntries.length - 1 ? "border-b border-line" : ""
                      }`}
                    >
                      <div className="flex flex-col items-center shrink-0 pt-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: i === 0 ? primary : "#E8EAEF" }}
                        />
                        {i < project.diaryEntries.length - 1 && (
                          <span className="w-px flex-1 bg-line mt-1.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-caption text-text-muted">
                          {formatLongDay(new Date(entry.date), quoteLanguage)}
                        </div>
                        {/* Structured, not just paragraphed. A kick-off update
                            is a week-by-week plan and now looks like one. */}
                        <div className="mt-1">
                          <UpdateBody text={entry.body} size="body" />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {project.diaryEntries.length === 0 && (
              <p className="text-body text-text-muted m-0">{q.noUpdates}</p>
            )}
          </div>
        </div>

        {studio && (
          <p className="text-center text-caption text-text-muted mt-5 mb-0">{studio}</p>
        )}
      </div>
    </div>
  );
}
