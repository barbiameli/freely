"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Topbar } from "@/components/topbar";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Trash2, Save, KeyRound } from "lucide-react";
import { updateAccountAction, changePasswordAction, deleteAccountAction } from "@/actions/account";
import { useT } from "@/lib/i18n/context";

export function AccountView({
  name,
  studioName,
  email,
  hasPassword,
}: {
  name: string | null;
  studioName: string | null;
  email: string;
  hasPassword: boolean;
}) {
  const t = useT();
  return (
    <>
      <Topbar />
      <div>
        <h1 className="font-display italic text-[32px] text-coral m-0">{t.account.yourAccount}</h1>
        <p className="text-slate text-small mt-2">
          Basic info only, nothing here is shared with clients. Branding and quoting preferences
          live in Memory.
        </p>
      </div>
      <div className="flex flex-col gap-5 max-w-lg">
        <BasicInfoCard name={name} studioName={studioName} email={email} />
        <PasswordCard hasPassword={hasPassword} />
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
          <div className="text-caption text-text-muted mb-1">Name</div>
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
        {saved && <span className="text-xs text-success font-semibold">Updated</span>}
      </div>
    </Card>
  );
}

function DangerZoneCard() {
  const t = useT();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete your account? This permanently removes every quote, project, and file you've saved, this can't be undone."
      )
    ) {
      return;
    }
    if (!window.confirm("Really sure? There's no way to get this back once it's gone.")) {
      return;
    }
    setDeleting(true);
    setError("");
    const result = await deleteAccountAction();
    if (!result.ok) {
      setDeleting(false);
      setError(result.error);
      return;
    }
    await signOut({ callbackUrl: "/signin" });
  }

  return (
    <Card className="border-overdue/30">
      <Label>{t.account.dangerZone}</Label>
      <p className="text-caption text-text-muted mt-1 mb-2.5">
        Permanently deletes your account, quotes, projects, and everything saved to Memory.
      </p>
      {error && <div className="text-overdue text-xs mb-2.5">{error}</div>}
      <Button
        variant="ghost"
        icon={Trash2}
        disabled={deleting}
        onClick={handleDelete}
        className="text-overdue border-overdue/30 hover:text-overdue"
      >
        {deleting ? "Deleting..." : "Delete my account"}
      </Button>
    </Card>
  );
}
