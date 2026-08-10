import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { FreelyLogo } from "@/components/freely-logo";
import { serverDict } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n";
import { InviteForm } from "./invite-form";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const t = await serverDict();
  const invite = await prisma.teamInvite.findUnique({
    where: { token: params.token },
    include: { team: true },
  });

  const invalid = !invite || Boolean(invite.usedAt);

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <Card className="w-full max-w-sm">
        <div className="mb-1">
          <FreelyLogo />
        </div>
        {invalid ? (
          <p className="text-slate text-sm">{t.auth.inviteInvalid}</p>
        ) : (
          <>
            <p className="text-slate text-sm mb-6">
              {fill(t.auth.invitedToJoin, { team: invite!.team.name })}
            </p>
            <InviteForm token={params.token} presetEmail={invite!.email} />
          </>
        )}
      </Card>
    </div>
  );
}
