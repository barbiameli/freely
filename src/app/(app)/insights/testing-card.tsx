"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { ActionError } from "@/components/ui/action-error";
import { replayOnboardingAction, resetMyAccountAction } from "@/actions/testing";

/**
 * Testing Freely on your own account, without a new email each time.
 *
 * Two buttons, both destructive, both admin-only on the server as well as
 * here: hiding a control is not a permission, and the actions check
 * ADMIN_EMAIL themselves.
 *
 * The pair is deliberate. Replaying onboarding on an account with history
 * shows the first run as somebody returning to it would see it, which is the
 * state that keeps breaking; a full reset shows it as a stranger would. Both
 * are worth being able to reach, and neither is reachable today without
 * inventing an email address.
 */
export function TestingCard() {
  const router = useRouter();
  const [replaying, setReplaying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function replay() {
    setError("");
    setWorking(true);
    const result = await replayOnboardingAction();
    setWorking(false);
    setReplaying(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Straight there, because the point of pressing it is to see it.
    router.push("/onboarding");
  }

  async function reset() {
    setError("");
    setWorking(true);
    const result = await resetMyAccountAction();
    setWorking(false);
    setConfirming(false);
    setResetting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(`${result.data.deleted} things deleted. Signing you into a blank account.`);
    router.push("/onboarding");
  }

  return (
    <Card tone="quiet">
      <CardHeader
        title={<>Testing</>}
        hint={
          <>
            Only you can see this. Both of these act on your own account, and neither one deletes
            your login.
          </>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-body font-semibold text-small text-ink">Replay onboarding</div>
            <p className="text-caption text-slate mt-0.5 mb-0 max-w-prose text-pretty">
              Forgets your industry and the coach marks, so the first run starts again. Your
              quotes, projects and Memory stay exactly as they are.
            </p>
          </div>
          <Button
            variant="outline"
            icon={RotateCcw}
            spinIcon={working && replaying}
            disabled={working}
            onClick={() => {
              setReplaying(true);
              void replay();
            }}
          >
            Replay
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-line">
          <div className="min-w-0">
            <div className="font-body font-semibold text-small text-ink">Start from nothing</div>
            <p className="text-caption text-slate mt-0.5 mb-0 max-w-prose text-pretty">
              Deletes every quote, project, invoice and Memory file on this account, then sends you
              back through onboarding. The account and its email survive.
            </p>
          </div>
          <Button
            variant="danger"
            icon={Trash2}
            spinIcon={working && resetting}
            disabled={working}
            onClick={() => {
              setResetting(true);
              setConfirming(true);
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <ActionError error={error} className="mt-3" />
      {done && <p className="text-caption text-slate mt-3 mb-0">{done}</p>}

      <Confirm
        open={confirming}
        onClose={() => {
          setConfirming(false);
          setResetting(false);
        }}
        onConfirm={() => void reset()}
        working={working}
        title="Delete everything on this account?"
        hint="Quotes, projects, invoices and Memory. There is no undo, and published quote links will stop working."
        confirmLabel="Delete it all"
      >
        <p className="text-small text-ink m-0">
          Your sign-in stays. You will land on onboarding as a new account does.
        </p>
      </Confirm>
    </Card>
  );
}
