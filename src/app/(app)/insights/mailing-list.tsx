"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  addressList,
  summarise,
  failures,
  sourceLabel,
  type Subscriber,
  type SendRow,
} from "@/lib/mailing";
import { formatDay } from "@/lib/schedule";

/**
 * Who said yes to product news, and what Freely has been sending.
 *
 * Both were stored and neither was visible: the consent columns were only ever
 * written by the person themselves, and the send log was written on every send
 * and read by nothing. Storing something nobody can look at is the same as not
 * storing it, apart from still being responsible for it.
 *
 * No export file and no bulk send. Copying the addresses is the whole feature,
 * because the sending happens somewhere else and pretending otherwise would
 * mean building a mail tool. A download would also put a list of people's email
 * addresses in a file in somebody's Downloads folder, which is a worse place
 * for it than a clipboard that clears itself.
 */
export function MailingList({
  subscribers,
  accounts,
  sends,
}: {
  subscribers: Subscriber[];
  accounts: number;
  /** The recent send log, newest first. */
  sends: SendRow[];
}) {
  const [copied, setCopied] = useState(false);
  const summary = summarise(sends);
  const bounced = failures(sends);
  const addresses = addressList(subscribers);

  async function copy() {
    await navigator.clipboard.writeText(addresses);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Label>Mailing list</Label>
            <p className="text-caption text-text-muted mt-1 mb-0">
              Everyone who opted in to product news. {subscribers.length} of {accounts} accounts.
            </p>
          </div>
          {subscribers.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              icon={copied ? Check : Copy}
              onClick={copy}
            >
              {copied ? "Copied" : "Copy addresses"}
            </Button>
          )}
        </div>

        {subscribers.length === 0 ? (
          <p className="text-small text-text-muted mt-4 mb-0">
            Nobody has opted in yet. The box is on the signup form and in Account settings.
          </p>
        ) : (
          <div className="flex flex-col mt-3">
            {subscribers.map((s) => (
              <div
                key={s.email}
                className="flex items-baseline justify-between gap-3 py-2 border-b border-line/70 last:border-b-0"
              >
                <span className="text-small text-ink truncate">{s.email}</span>
                <span className="flex items-baseline gap-3 shrink-0">
                  <span className="text-caption text-text-muted">{sourceLabel(s.source)}</span>
                  <span className="text-caption text-text-muted tabular-nums">
                    {s.since ? formatDay(new Date(s.since), "en-GB") : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Said plainly, because getting it wrong is a legal problem rather
            than a tidiness one. Whatever tool actually sends the email keeps
            its own list, and the two will disagree the moment somebody
            unsubscribes there. */}
        <p className="text-caption text-text-muted mt-4 mb-0 text-pretty">
          Unsubscribes are recorded here. If you send from another tool, that tool keeps its own
          list, so decide which one is the source of truth before the first send.
        </p>
      </Card>

      <Card>
        <Label>Email sent</Label>
        <p className="text-caption text-text-muted mt-1 mb-3">
          Every message Freely has tried to send. Skipped means consent said no, or a nudge was
          held back as too soon.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            ["Sent", summary.sent],
            ["Skipped", summary.skipped],
            ["Failed", summary.failed],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-paper rounded-lg px-3.5 py-3">
              <div className="font-label text-caption uppercase tracking-[0.09em] text-text-muted">
                {label}
              </div>
              <div className="font-body font-bold text-body text-ink tabular-nums mt-0.5">
                {value}
              </div>
            </div>
          ))}
        </div>

        {bounced.length > 0 && (
          <div className="mt-4">
            {/* Separate, because a bounced password reset is somebody locked
                out of their account and it is invisible in a list where nine
                rows in ten say sent. */}
            <div className="font-body font-semibold text-small text-overdue">
              Did not arrive
            </div>
            <div className="flex flex-col mt-1.5">
              {bounced.map((row, i) => (
                <div
                  key={`${row.to}-${i}`}
                  className="py-2 border-b border-line/70 last:border-b-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-small text-ink truncate">{row.to}</span>
                    <span className="text-caption text-text-muted shrink-0 tabular-nums">
                      {formatDay(new Date(row.createdAt), "en-GB")}
                    </span>
                  </div>
                  <div className="text-caption text-text-muted mt-0.5 text-pretty">
                    {readable(row.kind)}
                    {row.error ? `: ${row.error}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

/** Kinds as English rather than as identifiers. */
function readable(kind: string): string {
  return kind.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}
