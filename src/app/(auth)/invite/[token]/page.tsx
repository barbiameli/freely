import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { FreelyLogo } from "@/components/freely-logo";
import { InviteForm } from "./invite-form";

export default async function InvitePage({ params }: { params: { token: string } }) {
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
          <p className="text-slate text-sm">
            This invite link is invalid or has already been used, ask whoever sent it for a new one.
          </p>
        ) : (
          <>
            <p className="text-slate text-sm mb-6">
              You&apos;ve been invited to join {invite!.team.name}. Set a password to join.
            </p>
            <InviteForm token={params.token} presetEmail={invite!.email} />
          </>
        )}
      </Card>
    </div>
  );
}
