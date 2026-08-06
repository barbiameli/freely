import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PublicProjectPage({ params }: { params: { slug: string } }) {
  const project = await prisma.project.findUnique({
    where: { publicSlug: params.slug },
    include: {
      deliverables: { orderBy: { order: "asc" } },
      diaryEntries: { orderBy: { date: "desc" }, take: 1 },
      user: {
        select: { brandPrimaryColor: true, brandAccentColor: true, brandLogoDataUrl: true },
      },
    },
  });

  if (!project || !project.published) notFound();

  const latest = project.diaryEntries[0];
  const doneCount = project.deliverables.filter((d) => d.done).length;
  const primary = project.user.brandPrimaryColor || "#F45B69";

  const STATUS_COLOR: Record<string, string> = {
    ACTIVE: "text-violet",
    DUE: "text-coral",
    OVERDUE: "text-overdue",
    DONE: "text-success",
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white border border-line rounded-card shadow-panel overflow-hidden">
        <div className="bg-paper px-6 py-4 flex items-center justify-between">
          {project.user.brandLogoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.user.brandLogoDataUrl} alt="" className="h-7" />
          ) : (
            <span className="font-display italic text-2xl" style={{ color: primary }}>
              Freely
            </span>
          )}
          <span className="font-label text-xs text-slate uppercase">Project update</span>
        </div>
        <div className="p-8 flex flex-col gap-4">
          <div>
            <h1 className="font-display italic text-3xl m-0" style={{ color: primary }}>{project.title}</h1>
            <p className="text-slate text-sm mt-1.5">{project.client}</p>
          </div>

          {project.status === "DONE" ? (
            <div className="bg-mint-solid rounded-lg px-4 py-3 font-label text-sm text-success">
              Milestone sign-off received
            </div>
          ) : (
            <div className={`font-body font-semibold text-sm ${STATUS_COLOR[project.status]}`}>
              Status: {project.status}
              {project.timeline ? ` · ${project.timeline}` : ""}
            </div>
          )}

          <div>
            <div className="font-label text-xs text-slate uppercase mb-2">Latest update</div>
            {latest ? (
              <div className="bg-paper rounded-lg p-4">
                <div className="font-body font-bold text-sm text-ink mb-1">{latest.title}</div>
                <p className="text-[13.5px] text-slate m-0 leading-relaxed">{latest.body}</p>
                <div className="text-[11px] text-text-muted mt-2">
                  {new Date(latest.date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            ) : (
              <p className="text-[13.5px] text-slate">No updates yet.</p>
            )}
          </div>

          <div>
            <div className="font-label text-xs text-slate uppercase mb-2">
              Deliverables ({doneCount}/{project.deliverables.length})
            </div>
            <div className="flex flex-col gap-1.5">
              {project.deliverables.map((d) => (
                <div key={d.id} className={`text-sm ${d.done ? "text-success" : "text-slate"}`}>
                  {d.done ? "✓" : "○"} {d.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
