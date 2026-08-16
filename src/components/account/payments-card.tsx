"use client";

import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import {
  startStripeConnectAction,
  refreshStripeStatusAction,
  stripeDashboardAction,
  disconnectStripeAction,
} from "@/actions/account";
import type { ConnectState } from "@/lib/stripe-connect";
import { useT } from "@/lib/i18n/context";

/**
 * Linking a freelancer's own Stripe account, in three states.
 *
 * Not connected, connected but still being checked, and connected. They are
 * genuinely different situations and collapsing them into a single toggle is
 * how somebody ends up with a Pay button on an invoice that Stripe will refuse,
 * in front of a client.
 *
 * The card says the money goes from the client to them, because that is the
 * question anybody has when an app asks to be connected to their payments, and
 * leaving it unsaid invites the worse assumption.
 */
export function PaymentsCard({
  state,
  justReturned,
}: {
  state: ConnectState;
  /** They have just come back from Stripe, so the status is worth re-reading. */
  justReturned: boolean;
}) {
  const t = useT();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  // Coming back from Stripe means the answer has probably changed, and asking
  // Stripe is the only way to know. Cheap, and only on the trip back.
  useEffect(() => {
    if (!justReturned) return;
    setChecking(true);
    void refreshStripeStatusAction().finally(() => setChecking(false));
  }, [justReturned]);

  // Nothing to offer: the platform has no Stripe key, which is Freely's
  // problem rather than theirs, so the card stays away entirely.
  if (state === "unavailable") return null;

  async function connect() {
    setWorking(true);
    setError("");
    const result = await startStripeConnectAction();
    if (!result.ok) {
      setError(result.error);
      setWorking(false);
      return;
    }
    // Stripe hosts the sign-up. Same tab, since they come back to this page.
    window.location.href = result.data.url;
  }

  async function openDashboard() {
    setWorking(true);
    setError("");
    const result = await stripeDashboardAction();
    setWorking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.open(result.data.url, "_blank", "noreferrer");
  }

  async function recheck() {
    setChecking(true);
    setError("");
    const result = await refreshStripeStatusAction();
    setChecking(false);
    if (!result.ok) setError(result.error);
    else window.location.reload();
  }

  async function disconnect() {
    setWorking(true);
    setError("");
    const result = await disconnectStripeAction();
    setWorking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.location.reload();
  }

  return (
    <Card>
      <Label>{t.account.paymentsTitle}</Label>

      {state === "none" && (
        <>
          <p className="text-small text-slate mt-1.5 mb-1 text-pretty">
            {t.account.paymentsIntro}
          </p>
          <p className="text-caption text-text-muted mt-0 mb-4">
            {t.account.paymentsSignupNote} {t.account.paymentsPdfAlways}
          </p>
          <Button icon={CreditCard} onClick={connect} disabled={working}>
            {t.account.paymentsConnect}
          </Button>
        </>
      )}

      {state === "pending" && (
        <>
          <div className="font-body font-semibold text-small text-ink mt-1.5">
            {t.account.paymentsPendingTitle}
          </div>
          <p className="text-caption text-text-muted mt-1 mb-4 text-pretty">
            {t.account.paymentsPendingHint}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button icon={CreditCard} onClick={connect} disabled={working}>
              {t.account.paymentsFinish}
            </Button>
            <button
              type="button"
              onClick={recheck}
              disabled={checking}
              className="text-caption text-slate hover:text-ink bg-none border-none cursor-pointer p-0 tap"
            >
              {t.account.paymentsCheck}
            </button>
          </div>
        </>
      )}

      {state === "ready" && (
        <>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Check size={13} className="text-success shrink-0" />
            <span className="font-body font-semibold text-small text-ink">
              {t.account.paymentsReadyTitle}
            </span>
          </div>
          <p className="text-caption text-text-muted mt-1 mb-4 text-pretty">
            {t.account.paymentsReadyHint}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button icon={ExternalLink} onClick={openDashboard} disabled={working}>
              {t.account.paymentsDashboard}
            </Button>
            <button
              type="button"
              onClick={disconnect}
              disabled={working}
              className="text-caption text-slate hover:text-ink bg-none border-none cursor-pointer p-0 tap"
            >
              {t.account.paymentsDisconnect}
            </button>
          </div>
          <p className="text-caption text-text-muted mt-3 mb-0">
            {t.account.paymentsDisconnectHint}
          </p>
        </>
      )}

      <ActionError error={error} />
    </Card>
  );
}
