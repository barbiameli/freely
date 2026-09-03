"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ActionError } from "@/components/ui/action-error";
import { useT } from "@/lib/i18n/context";
import { GROUND_RULES, type RuleKey, type RuleSettings } from "@/lib/ground-rules";
import { setRuleAction, setMaxUnpaidHoursAction } from "@/actions/ground-rules";
import { ruleWords } from "@/lib/rule-words";

/**
 * The rulebook, as a page you can read.
 *
 * Deliberately not a settings screen with a list of toggles and no
 * explanation. A rule nobody understands gets switched off the first time it
 * is inconvenient, so each one says why it exists and what it costs when it is
 * missing, and the switch sits next to that rather than in a column of its
 * own. Somebody who reads three of these and turns two off has still learned
 * something, which is more than a page of checkboxes achieves.
 *
 * Saving is per rule and immediate. A page of preferences with a save button
 * at the bottom is a page where the save gets forgotten.
 */
export function RulesView({ settings }: { settings: RuleSettings }) {
  const t = useT();
  const [off, setOff] = useState<RuleKey[]>(settings.off);
  const [hours, setHours] = useState(String(settings.maxUnpaidHours));
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  function toggle(key: RuleKey) {
    const on = off.includes(key);
    // Set first, save after. A switch that waits on a round trip feels broken.
    setOff(on ? off.filter((k) => k !== key) : [...off, key]);
    setError("");
    startTransition(() => {
      void setRuleAction(key, on).then((result) => {
        if (!result.ok) setError(result.error);
      });
    });
  }

  function saveHours(value: string) {
    setHours(value);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    startTransition(() => {
      void setMaxUnpaidHoursAction(parsed);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t.rules.title} subtitle={t.rules.subtitle} />

      <p className="text-small text-slate m-0 max-w-prose text-pretty">{t.rules.intro}</p>

      <ActionError error={error} />

      <div className="flex flex-col gap-4">
        {GROUND_RULES.map((rule) => {
          const words = ruleWords(rule.key, t);
          const on = !off.includes(rule.key);
          return (
            <Card key={rule.key} tone={on ? undefined : "quiet"}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-body font-bold text-body text-ink m-0 text-pretty">
                    {words.title}
                  </h2>
                  <div className="font-body font-bold text-caption uppercase tracking-[0.08em] text-text-muted mt-1.5">
                    {rule.checkable
                      ? rule.severity === "blocking"
                        ? t.rules.blocking
                        : t.rules.suggestion
                      : t.rules.notChecked}
                  </div>
                </div>
                {/* The same checkbox the rest of the app uses, rather than a
                    switch invented for this page. */}
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(rule.key)}
                    className="accent-violet"
                  />
                  <span className="text-caption text-slate">{on ? t.rules.on : t.rules.off}</span>
                </label>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <div className="font-body font-bold text-caption uppercase tracking-[0.08em] text-slate">
                    {t.rules.why}
                  </div>
                  <p className="text-small text-ink mt-1 mb-0 max-w-prose text-pretty">
                    {words.why}
                  </p>
                </div>
                <div>
                  <div className="font-body font-bold text-caption uppercase tracking-[0.08em] text-slate">
                    {t.rules.cost}
                  </div>
                  <p className="text-small text-slate mt-1 mb-0 max-w-prose text-pretty">
                    {words.cost}
                  </p>
                </div>

                {/* The one rule that needs a number rather than a switch, and
                    it belongs to the person: what you can afford to be owed is
                    not something Freely can pick for you. */}
                {rule.key === "unpaidStretch" && on && (
                  <div className="pt-1">
                    <div className="font-body font-bold text-caption uppercase tracking-[0.08em] text-slate">
                      {t.rules.maxUnpaidTitle}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={hours}
                        onChange={(e) => saveHours(e.target.value)}
                        className="w-[92px] bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
                      />
                      <span className="text-slate text-sm">{t.rules.hours}</span>
                    </div>
                    <p className="text-caption text-text-muted mt-1.5 mb-0 max-w-prose text-pretty">
                      {t.rules.maxUnpaidHint}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
