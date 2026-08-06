import { listTeamAction } from "@/actions/team";
import { requireFullUser } from "@/lib/session";
import { TeamView } from "./team-view";

export default async function TeamPage() {
  const user = await requireFullUser();
  const { team, members, pendingInvites } = await listTeamAction();
  const isOwner = team?.ownerId === user.id;

  return (
    <TeamView
      teamName={team?.name ?? null}
      isOwner={isOwner}
      currentUserId={user.id}
      members={members}
      pendingInvites={pendingInvites.map((i) => ({
        id: i.id,
        email: i.email,
        url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/invite/${i.token}`,
      }))}
    />
  );
}
