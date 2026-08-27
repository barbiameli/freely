"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "@/lib/use-action";
import { UserPlus, Copy, X } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { ActionError } from "@/components/ui/action-error";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { createInviteAction, revokeInviteAction, removeMemberAction } from "@/actions/team";
import { useT } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/page-header";

interface Member {
  id: string;
  email: string;
}
interface PendingInvite {
  id: string;
  email: string | null;
  url: string;
}

export function TeamView({
  teamName,
  isOwner,
  currentUserId,
  members,
  pendingInvites,
}: {
  teamName: string | null;
  isOwner: boolean;
  currentUserId: string;
  members: Member[];
  pendingInvites: PendingInvite[];
}) {
  const router = useRouter();
  const t = useT();
  const { run, pending, error: actionError } = useAction();
  const [inviteEmail, setInviteEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [newInviteUrl, setNewInviteUrl] = useState("");

  async function handleInvite() {
    setWorking(true);
    setError("");
    const result = await createInviteAction(inviteEmail);
    setWorking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewInviteUrl(result.data.url);
    setInviteEmail("");
    router.refresh();
  }

  return (
    <>
      <Topbar />
      <PageHeader title={teamName ?? "Your studio"} subtitle={t.team.sharedWorkspace} />

      {isOwner || members.length <= 1 ? (
        <Card>
          <Label>{t.team.inviteTeammate}</Label>
          <div className="flex gap-2">
            <TextField
              value={inviteEmail}
              onChange={setInviteEmail}
              placeholder={t.team.invitePlaceholder}
            />
            <Button icon={UserPlus} disabled={working} onClick={handleInvite}>
              {t.team.createInvite}
            </Button>
          </div>
          {error && <div className="text-overdue text-xs mt-2">{error}</div>}
          {newInviteUrl && (
            <div className="flex items-center gap-2 mt-3 bg-paper rounded-lg px-3 py-2">
              <span className="text-xs text-slate truncate flex-1">{newInviteUrl}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(newInviteUrl)}
                className="text-violet"
                title={t.team.copyLink}
              >
                <Copy size={14} />
              </button>
            </div>
          )}
        </Card>
      ) : null}

      <ActionError error={actionError} />

      <Card>
        <Label>{t.team.members}</Label>
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <div key={m.id} className="flex justify-between items-center py-1.5">
              <span className="text-body text-ink">
                {m.email} {m.id === currentUserId && <span className="text-text-muted">{t.team.you}</span>}
              </span>
              {isOwner && m.id !== currentUserId && (
                <button
                  disabled={pending}
                  onClick={() => run(() => removeMemberAction(m.id))}
                  className="text-text-muted hover:text-overdue disabled:opacity-40"
                  title={t.team.removeFromTeam}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <div className="text-text-muted text-small">
              {t.team.justYou}
            </div>
          )}
        </div>
      </Card>

      {isOwner && pendingInvites.length > 0 && (
        <Card>
          <Label>{t.team.pendingInvites}</Label>
          <div className="flex flex-col gap-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex justify-between items-center py-1.5">
                <span className="text-body text-slate">
                  {inv.email ?? t.team.shareableLink}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(inv.url)}
                    className="text-violet"
                    title={t.team.copyLink}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => run(() => revokeInviteAction(inv.id))}
                    className="text-text-muted hover:text-overdue disabled:opacity-40"
                    title={t.team.revoke}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
