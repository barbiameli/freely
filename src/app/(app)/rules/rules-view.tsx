"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { ActionError } from "@/components/ui/action-error";
import { useT } from "@/lib/i18n/context";
import {
  GROUND_RULES,
  ruleValues,
  type RuleKey,
  type RuleSettings,
  type RuleValue,
  type ValueKey,
} from "@/lib/ground-rules";
import { setRuleAction, setRuleValueAction } from "@/actions/ground-rules";
import { ruleWords } from "@/lib/rule-words";
import { valueLabel } from "@/lib/rule-words";

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
  const [values, setValues] = useState<Record<ValueKey, number>>(() => ruleValues(settings));
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

  function saveValue(spec: RuleValue, raw: string) {
    const parsed = Number(raw);
    // Typed into, so an empty box and a half-typed number are normal states
    // rather than errors. Nothing is saved until it is a figure inside the
    // rule's own bounds.
    setValues((current) => ({ ...current, [spec.key]: Number.isFinite(parsed) ? parsed : 0 }));
    if (!Number.isFinite(parsed) || parsed < spec.min || parsed > spec.max) return;
    startTransition(() => {
      void setRuleValueAction(spec.key, parsed).then((result: { ok: boolean; error?: string }) => {
        if (!result.ok && result.error) setError(result.error);
      });
    });
  }

  /**
   * The rule as a sentence, with a field where each number goes.
   *
   * Split on the placeholders rather than rendered as a title above a row of
   * inputs. Reading "Payment is due within [14] days" and changing the 14 in
   * place is a rule; the same thing as a labelled numeric field is a setting,
   * and settings are what people stop reading.
   */
  function Statement({ rule }: { rule: (typeof GROUND_RULES)[number] }) {
    const words = ruleWords(rule.key, t);
    const specs = [rule.value, rule.extra].filter(Boolean) as RuleValue[];
    const parts = words.statement.split(/(\{\w+\})/);

    return (
      <p className="text-small text-ink m-0 max-w-prose text-pretty leading-[1.9]">
        {parts.map((part, i) => {
          const name = part.startsWith("{") ? part.slice(1, -1) : "";
          const spec = specs.find((s) => s.key === name);
          if (!spec) return <span key={i}>{part}</span>;
          return (
            <input
              key={i}
              type="number"
              min={spec.min}
              max={spec.max}
              value={values[spec.key] ?? spec.fallback}
              onChange={(e) => saveValue(spec, e.target.value)}
              aria-label={valueLabel(spec.key, t)}
              className="w-[58px] mx-1 bg-paper rounded-lg border-none px-2 py-1 text-sm font-semibold text-violet text-center outline-none focus:ring-1 focus:ring-violet"
            />
          );
        })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* No page header: this is a tab inside Memory now, and the tab strip
          above it has already said where you are. */}
      <p className="text-small text-slate m-0 max-w-prose text-pretty">{t.rules.intro}</p>
      <p className="text-caption text-text-muted m-0 max-w-prose text-pretty">
        {t.rules.statedHint} {t.rules.sourceNote}
      </p>

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
                {on && (
                  <div>
                    <div className="font-body font-bold text-caption uppercase tracking-[0.08em] text-slate">
                      {t.rules.stated}
                    </div>
                    <div className="mt-1.5">
                      <Statement rule={rule} />
                    </div>
                  </div>
                )}
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
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
