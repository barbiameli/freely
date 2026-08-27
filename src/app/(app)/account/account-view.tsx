"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label, CardHeader } from "@/components/ui/label";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Trash2, Save, KeyRound } from "lucide-react";
import { updateAccountAction, changePasswordAction, deleteAccountAction } from "@/actions/account";
import { setMarketingOptInAction, setNudgeEmailsAction } from "@/actions/marketing";
import { Confirm } from "@/components/ui/confirm";
import { PaymentsCard } from "@/components/account/payments-card";
import type { ConnectState } from "@/lib/stripe-connect";
import { useT } from "@/lib/i18n/context";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";

export function AccountView({
  name,
  studioName,
  email,
  hasPassword,
  nudgeEmails,
  marketingOptIn,
  stripeState,
  justReturnedFromStripe,
}: {
  name: string | null;
  studioName: string | null;
  email: string;
  hasPassword: boolean;
  /** Reminders about this person's own work. On by default. */
  nudgeEmails: boolean;
  /** Product news. Off unless they said yes. */
  marketingOptIn: boolean;
  /** Where they are with linking their own Stripe account. */
  stripeState: ConnectState;
  justReturnedFromStripe: boolean;
}) {
  const t = useT();
  return (
    <>
      <Topbar />
      <PageHeader title={t.account.yourAccount} subtitle={t.account.basicInfoOnly} />
      {/* Five unrelated cards in one column read as a list of settings with no
          shape. Three bands instead: who you are, how you get paid and get
          told things, and the one that cannot be undone. */}
      <div className="flex flex-col gap-5 max-w-lg">
        <SectionHeading title={t.account.groupYou} hint={t.account.groupYouHint} />
        <BasicInfoCard name={name} studioName={studioName} email={email} />
        <PasswordCard hasPassword={hasPassword} />

        <SectionHeading title={t.account.groupRunning} hint={t.account.groupRunningHint} />
        <PaymentsCard state={stripeState} justReturned={justReturnedFromStripe} />
        <EmailSettingsCard nudgeEmails={nudgeEmails} marketingOptIn={marketingOptIn} />

        <SectionHeading title={t.account.groupEnding} hint={t.account.groupEndingHint} />
        <DangerZoneCard />
      </div>
    </>
  );
}

function BasicInfoCard({
  name,
  studioName,
  email,
}: {
  name: string | null;
  studioName: string | null;
  email: string;
}) {
  const t = useT();
  const [nameValue, setNameValue] = useState(name ?? "");
  const [studioValue, setStudioValue] = useState(studioName ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    const result = await updateAccountAction({ name: nameValue, studioName: studioValue });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <Label>{t.account.basicInfo}</Label>
      <div className="flex flex-col gap-2.5 mt-2.5">
        <div>
          <div className="text-caption text-text-muted mb-1">{t.account.name}</div>
          <TextField value={nameValue} onChange={setNameValue} placeholder={t.onboarding.yourName} />
        </div>
        <div>
          <div className="text-caption text-text-muted mb-1">{t.account.studioOrBusiness}</div>
          <TextField value={studioValue} onChange={setStudioValue} placeholder={t.common.optional} />
        </div>
        <div>
          <div className="text-caption text-text-muted mb-1">{t.account.email}</div>
          <div className="text-sm text-ink bg-paper rounded-lg px-3.5 py-3">{email}</div>
        </div>
      </div>
      {error && <div className="text-overdue text-xs mt-2">{error}</div>}
      <div className="flex items-center gap-3 mt-3">
        <Button
          icon={Save}
          spinIcon={saving}
          disabled={saving || !nameValue.trim()}
          onClick={handleSave}
        >
          {saving ? "Saving..." : "Save changes"}
        </Button>
        {saved && <span className="text-xs text-success font-semibold">{t.memory.saved}</span>}
      </div>
    </Card>
  );
}

function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const t = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setSaving(true);
    const result = await changePasswordAction({ currentPassword: current, newPassword: next });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <Label>{t.account.password}</Label>
      {!hasPassword && (
        <p className="text-caption text-text-muted mt-1 mb-1">
          You signed in with Google and don&apos;t have a password yet, set one below if you&apos;d
          like to be able to sign in with email too.
        </p>
      )}
      <div className="flex flex-col gap-2.5 mt-2.5">
        {hasPassword && (
          <div>
            <div className="text-caption text-text-muted mb-1">{t.account.currentPassword}</div>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full font-body text-body text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
            />
          </div>
        )}
        <div>
          <div className="text-caption text-text-muted mb-1">{t.account.newPassword}</div>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={t.auth.min8}
            className="w-full font-body text-body text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
          />
        </div>
        <div>
          <div className="text-caption text-text-muted mb-1">{t.account.confirmNewPassword}</div>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full font-body text-body text-ink bg-paper border border-line rounded-lg px-3.5 py-3 outline-none box-border"
          />
        </div>
      </div>
      {error && <div className="text-overdue text-xs mt-2">{error}</div>}
      <div className="flex items-center gap-3 mt-3">
        <Button
          variant="outline"
          icon={KeyRound}
          spinIcon={saving}
          disabled={saving || next.length < 8 || !confirm}
          onClick={handleSave}
        >
          {saving ? "Updating..." : hasPassword ? "Update password" : "Set password"}
        </Button>
        {saved && <span className="text-xs text-success font-semibold">{t.account.updated}</span>}
      </div>
    </Card>
  );
}

function DangerZoneCard() {
  const t = useT();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  // Asked once, in a dialog that says what goes. It used to ask twice through
  // the browser, which teaches somebody to click through both without reading.
  async function handleDelete() {
    setConfirming(false);
    setDeleting(true);
    setError("");
    const result = await deleteAccountAction();
    if (!result.ok) {
      setDeleting(false);
      setError(result.error);
      return;
    }
    await signOut({ callbackUrl: "/" });
  }

  return (
    <Card className="border-overdue/30">
      <CardHeader title={<>{t.account.dangerZone}</>} hint={<>{t.account.deleteWarning}</>} />
      {error && <div className="text-overdue text-xs mb-2.5">{error}</div>}
      <Button variant="danger" icon={Trash2} disabled={deleting} onClick={() => setConfirming(true)}>
        {t.common.confirmDeleteAccountAction}
      </Button>

      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={handleDelete}
        working={deleting}
        title={t.common.confirmDeleteAccount}
        hint={t.common.confirmDeleteAccountHint}
        confirmLabel={t.common.confirmDeleteAccountAction}
      >
        <p className="text-small text-slate m-0 text-pretty">{t.account.deleteWarning}</p>
      </Confirm>
    </Card>
  );
}

/**
 * What Freely is allowed to email about.
 *
 * Two switches, and keeping them apart is the point. The nudges are about this
 * person's own work and their own money, so they default on and are turned off
 * here. Product news is marketing, so it defaults off and only ever goes on
 * because somebody said yes.
 *
 * Saved on the click rather than behind a Save button, because a preference
 * with a Save button is a preference somebody thinks they changed.
 *
 * The line at the bottom is not a disclaimer. Somebody turning both off still
 * needs a password reset to reach them, and saying so is what stops that being
 * a surprise later.
 */
function EmailSettingsCard({
  nudgeEmails,
  marketingOptIn,
}: {
  nudgeEmails: boolean;
  marketingOptIn: boolean;
}) {
  const t = useT();
  const [nudges, setNudges] = useState(nudgeEmails);
  const [marketing, setMarketing] = useState(marketingOptIn);

  return (
    <Card>
      <Label>{t.account.emailsTitle}</Label>
      <div className="flex flex-col gap-3 mt-3">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={nudges}
            onChange={(e) => {
              setNudges(e.target.checked);
              void setNudgeEmailsAction(e.target.checked);
            }}
            className="mt-[3px] accent-violet shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-small text-ink">{t.account.nudgesLabel}</span>
            <span className="block text-caption text-text-muted mt-0.5">
              {t.account.nudgesHint}
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => {
              setMarketing(e.target.checked);
              void setMarketingOptInAction(e.target.checked);
            }}
            className="mt-[3px] accent-violet shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-small text-ink">{t.auth.marketingOptIn}</span>
            <span className="block text-caption text-text-muted mt-0.5">
              {t.auth.marketingOptInHint}
            </span>
          </span>
        </label>
      </div>
      <p className="text-caption text-text-muted mt-3 mb-0">{t.account.alwaysSent}</p>
    </Card>
  );
}
