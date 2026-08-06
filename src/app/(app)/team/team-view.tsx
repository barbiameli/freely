"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Copy, X } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { createInviteAction, revokeInviteAction, removeMemberAction } from "@/actions/team";

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
      <Topbar eyebrow="Team" />
      <div>
        <h1 className="font-display italic text-[32px] text-coral m-0">
          {teamName ?? "Your studio"}
        </h1>
        <p className="text-slate text-[13px] mt-2">
          Everyone on your team sees the same Quotes, Projects, and Diary — invite a teammate to
          share the work.
        </p>
      </div>

      {isOwner || members.length <= 1 ? (
        <Card>
          <Label>Invite a teammate</Label>
          <div className="flex gap-2">
            <TextField
              value={inviteEmail}
              onChange={setInviteEmail}
              placeholder="teammate@studio.com (optional — leave blank for a shareable link)"
            />
            <Button icon={UserPlus} disabled={working} onClick={handleInvite}>
              Create invite
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
                title="Copy link"
              >
                <Copy size={14} />
              </button>
            </div>
          )}
        </Card>
      ) : null}

      <Card>
        <Label>Members</Label>
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <div key={m.id} className="flex justify-between items-center py-1.5">
              <span className="text-[13.5px] text-ink">
                {m.email} {m.id === currentUserId && <span className="text-text-muted">(you)</span>}
              </span>
              {isOwner && m.id !== currentUserId && (
                <button
                  onClick={async () => {
                    await removeMemberAction(m.id);
                    router.refresh();
                  }}
                  className="text-text-muted hover:text-overdue"
                  title="Remove from team"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <div className="text-text-muted text-[13px]">
              Just you for now — invite a teammate above.
            </div>
          )}
        </div>
      </Card>

      {isOwner && pendingInvites.length > 0 && (
        <Card>
          <Label>Pending invites</Label>
          <div className="flex flex-col gap-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex justify-between items-center py-1.5">
                <span className="text-[13.5px] text-slate">
                  {inv.email ?? "Shareable link"}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(inv.url)}
                    className="text-violet"
                    title="Copy link"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      await revokeInviteAction(inv.id);
                      router.refresh();
                    }}
                    className="text-text-muted hover:text-overdue"
                    title="Revoke"
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
