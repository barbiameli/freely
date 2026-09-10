"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Trash2, UserCheck } from "lucide-react";
import { inviteVisitorAction, removeVisitorAction } from "@/actions/portal";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Confirm } from "@/components/ui/confirm";
import { SectionHeading } from "@/components/ui/page-header";
import { useT, useLocale } from "@/lib/i18n/context";
import { formatLongDay } from "@/lib/schedule";

export interface PortalPerson {
  id: string;
  email: string;
  name: string;
  hasPassword: boolean;
  verified: boolean;
  lastSeenAt: string | null;
}

/**
 * Who can open the client's page.
 *
 * This is the access control, not a contact list. The portal renders nothing
 * to anybody who is not on it, so adding a row is granting access and removing
 * one is taking it away, everywhere, at once. Worth saying plainly in the
 * interface rather than leaving somebody to infer it from a heading.
 *
 * The last-opened column is the part that gets looked at in practice: the week
 * before a deadline, "have they actually read this" is a real question and
 * there was previously no way to answer it.
 */
export function AccessPanel({
  clientId,
  people,
  bare,
}: {
  clientId: string;
  people: PortalPerson[];
  /** Inside the setup dialog, which brings its own heading and card. */
  bare?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<PortalPerson | null>(null);

  async function invite() {
    setBusy(true);
    setError("");
    const result = await inviteVisitorAction(clientId, email, name);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEmail("");
    setName("");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    const result = await removeVisitorAction(clientId, id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const rows = (
    <>
        {people.length === 0 ? (
          <p className="text-small text-slate m-0">{t.visitors.empty}</p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col">
            {people.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-3 py-2.5 border-b border-line last:border-b-0"
              >
                <UserCheck
                  size={14}
                  className={person.verified ? "text-success shrink-0" : "text-text-muted shrink-0"}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-body font-semibold text-small text-ink truncate">
                    {person.name || person.email}
                  </span>
                  <span className="block text-caption text-text-muted truncate">
                    {person.name ? `${person.email} · ` : ""}
                    {person.lastSeenAt
                      ? t.visitors.lastSeen.replace(
                          "{date}",
                          formatLongDay(new Date(person.lastSeenAt), locale)
                        )
                      : t.visitors.never}
                  </span>
                </span>
                {person.hasPassword && (
                  <KeyRound
                    size={13}
                    className="text-text-muted shrink-0"
                    aria-label={t.visitors.hasPassword}
                  />
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(person)}
                  aria-label={t.visitors.remove}
                  className="text-text-muted hover:text-overdue bg-none border-none cursor-pointer p-1 tap shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.visitors.nameLabel}
            aria-label={t.visitors.nameLabel}
            className="sm:w-36 rounded-sm px-3 py-2.5 text-small outline-none border border-line bg-white text-ink focus:border-violet"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.visitors.emailLabel}
            aria-label={t.visitors.emailLabel}
            className="flex-1 min-w-0 rounded-sm px-3 py-2.5 text-small outline-none border border-line bg-white text-ink focus:border-violet"
          />
          <Button size="sm" icon={Plus} disabled={!email.trim() || busy} onClick={() => void invite()}>
            {t.visitors.add}
          </Button>
        </div>

      <ActionError error={error} />
    </>
  );

  const dialog = (
    <Confirm
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          const person = confirming;
          setConfirming(null);
          if (person) void remove(person.id);
        }}
        title={t.visitors.removeTitle}
        hint={t.visitors.removeHint}
        confirmLabel={t.visitors.removeConfirm}
        working={busy}
      >
        {confirming && (
          <p className="font-body font-semibold text-small text-ink m-0">
            {confirming.name || confirming.email}
          </p>
        )}
    </Confirm>
  );

  if (bare) {
    return (
      <div className="flex flex-col gap-3.5">
        {rows}
        {dialog}
      </div>
    );
  }
  return (
    <>
      <SectionHeading title={t.visitors.title} hint={t.visitors.hint} />
      <Card className="flex flex-col gap-3.5">{rows}</Card>
      {dialog}
    </>
  );
}
