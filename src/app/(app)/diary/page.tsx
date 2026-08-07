import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireFullUser } from "@/lib/session";
import { teamScopeWhere } from "@/lib/team-scope";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";

export default async function DiaryIndexPage() {
  const user = await requireFullUser();
  const first = await prisma.project.findFirst({
    where: teamScopeWhere(user),
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (first) redirect(`/diary/${first.id}`);

  return (
    <>
      <Topbar eyebrow="Diary" />
      <div>
        <h1 className="font-display italic text-[32px] text-coral m-0">
          Client updates, written for you.
        </h1>
        <p className="text-slate text-[13px] mt-2">
          Auto-generated from your project tracker, edit anything before it goes out.
        </p>
      </div>
      <Card className="text-center text-slate p-10">
        No tracked projects yet, Diary entries come from Track.
      </Card>
    </>
  );
}
