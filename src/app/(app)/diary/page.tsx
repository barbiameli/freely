import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { currencySymbol } from "@/lib/currencies";
import { isFinished } from "@/lib/project-status";
import { Topbar } from "@/components/topbar";
import { DiaryIndex, type DiaryProjectRow } from "./diary-index";

export default async function DiaryIndexPage() {
  const user = await requireFullUser();

  // No redirect to the newest project any more: that hid the list entirely, so
  // there was no way to see which clients were waiting on an update.
  const projects = await prisma.project.findMany({
    where: teamScopeWhere(user),
    include: {
      deliverables: { select: { done: true } },
      _count: { select: { diaryEntries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows: DiaryProjectRow[] = projects.map((p) => {
    const done = p.deliverables.filter((d) => d.done).length;
    return {
      id: p.id,
      title: p.title,
      client: p.client,
      status: p.status,
      progress: p.deliverables.length > 0 ? done / p.deliverables.length : 0,
      meta: `${currencySymbol(p.currency)}${p.price.toLocaleString()} · ${done}/${p.deliverables.length}`,
      finished: isFinished({ status: p.status, deliverables: p.deliverables }),
      published: p.published,
      entryCount: p._count.diaryEntries,
    };
  });

  return (
    <>
      <Topbar eyebrow="Diary" />
      <DiaryIndex projects={rows} />
    </>
  );
}
