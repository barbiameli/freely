"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import { useT } from "@/lib/i18n/context";
import { setProjectTimeModeAction } from "@/actions/time";
import type { TimeMode } from "@/lib/time-tracking";

/**
 * What tracking is for on this engagement.
 *
 * Asked once, per project, rather than switched on for the account. The same
 * person tracks a fixed-price job to find out what it really cost and an
 * hourly one because the client is paying for the hours, and one account-wide
 * answer would force one of those onto the other.
 *
 * Each option includes the one above it, so this is a dial rather than a set
 * of independent switches, and turning it up never takes anything away.
 *
 * "Use this on new projects too" is offered rather than assumed. Somebody
 * answering for the first time has no way of knowing whether their answer
 * generalises, so the default is to ask again.
 */
export function TimeSetUp({
  projectId,
  open,
  onClose,
  current,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  /**
   * What it is set to now, when it is set to anything.
   *
   * The answer moves: a job somebody tracked privately becomes one the client
   * is billed for, and a setup that could only be answered once would make
   * them start a new project to change their mind.
   */
  current?: TimeMode | null;
}) {
  const t = useT();
  const [mode, setMode] = useState<TimeMode>(
    current && current !== "OFF" ? current : "RECORD"
  );
  const [asDefault, setAsDefault] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const options: { key: TimeMode; title: string; what: string }[] = [
    { key: "RECORD", title: t.track.modeRecord, what: t.track.modeRecordWhat },
    { key: "LEARN", title: t.track.modeLearn, what: t.track.modeLearnWhat },
    { key: "BILLING", title: t.track.modeBilling, what: t.track.modeBillingWhat },
  ];

  async function save() {
    setError("");
    setWorking(true);
    const result = await setProjectTimeModeAction({ projectId, mode, asDefault });
    setWorking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={t.track.timeSetUp} hint={t.track.timeSetUpModalHint}>
      <div className="flex flex-col gap-2.5">
        {options.map((option) => {
          const on = mode === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setMode(option.key)}
              aria-pressed={on}
              className={`w-full text-left rounded-card border-l-[3px] px-4 py-3.5 cursor-pointer tap-row transition-colors ${
                on ? "bg-violet-tint border-violet" : "bg-paper border-line"
              }`}
            >
              <span className="block font-body font-bold text-small text-ink">{option.title}</span>
              <span className="block text-caption text-slate mt-1 text-pretty">{option.what}</span>
            </button>
          );
        })}
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer mt-4">
        <input
          type="checkbox"
          checked={asDefault}
          onChange={(e) => setAsDefault(e.target.checked)}
          className="mt-[3px] accent-violet shrink-0"
        />
        <span className="min-w-0">
          <span className="block text-small text-ink">{t.track.timeAsDefault}</span>
          <span className="block text-caption text-text-muted mt-0.5 text-pretty">
            {t.track.timeAsDefaultHint}
          </span>
        </span>
      </label>

      <ActionError error={error} className="mt-3" />

      <div className="flex justify-end mt-5">
        <Button loading={working} onClick={() => void save()}>
          {t.track.timeSetUpDone}
        </Button>
      </div>
    </Modal>
  );
}
