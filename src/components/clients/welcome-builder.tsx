"use client";

import { useState } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { draftWelcomePackAction, setOnboardingAction } from "@/actions/portal";
import { WELCOME_QUESTIONS, answeredCount } from "@/lib/welcome-questions";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/context";

/**
 * Five questions, one at a time, in a friendly voice.
 *
 * Deliberately not a wizard. A wizard takes over the screen, insists on being
 * finished, and makes five easy questions feel like an application form. This
 * is a list: everything is visible, one row is open, and stopping after two is
 * a perfectly good outcome because two answers still make a better welcome
 * pack than none.
 *
 * Each question carries a line about why a client cares. Without it this reads
 * as admin somebody is making you do; with it, it reads as the thing that
 * stops the argument in week six.
 *
 * The chips are shortcuts for typing, not a closed list. "Two rounds" and "as
 * many as it takes" are both real ways to work, and a picker that only offers
 * the first is a picker that quietly tells people how to run their business.
 */
export function WelcomeBuilder({
  clientId,
  answers: saved,
  onDrafted,
}: {
  clientId: string;
  answers: Record<string, string>;
  /** The draft goes to the pack editor above, for a human to read and change. */
  onDrafted: (text: string) => void;
}) {
  const t = useT();
  const [answers, setAnswers] = useState<Record<string, string>>(saved);
  // The first one they have not done, so returning to this lands where they
  // left off rather than at the top.
  const [openId, setOpenId] = useState<string | null>(
    WELCOME_QUESTIONS.find((q) => !saved[q.id])?.id ?? null
  );
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");

  const done = answeredCount(answers);

  async function save(next: Record<string, string>) {
    setAnswers(next);
    setBusy(true);
    const result = await setOnboardingAction(clientId, next);
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  async function draft() {
    setDrafting(true);
    setError("");
    const result = await draftWelcomePackAction(clientId, answers);
    setDrafting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDrafted(result.data.text);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="font-body font-bold text-small text-ink m-0">{t.welcome.title}</p>
        <span className="font-label text-caption text-text-muted tabular-nums shrink-0">
          {t.welcome.progress
            .replace("{done}", String(done))
            .replace("{total}", String(WELCOME_QUESTIONS.length))}
        </span>
      </div>
      <p className="text-caption text-text-muted mt-0 mb-3">{t.welcome.hint}</p>

      <div className="flex flex-col">
        {WELCOME_QUESTIONS.map((question) => {
          const open = openId === question.id;
          const answer = answers[question.id] ?? "";
          return (
            <div key={question.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : question.id)}
                aria-expanded={open}
                className="w-full flex items-center gap-2.5 py-3 bg-none border-none cursor-pointer text-left tap-row"
              >
                <span
                  className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    answer ? "bg-mint-solid" : "bg-paper"
                  }`}
                  aria-hidden
                >
                  {answer && <Check size={12} strokeWidth={3} className="text-ink" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body font-semibold text-small text-ink">
                    {question.ask}
                  </span>
                  {answer && !open && (
                    <span className="block text-caption text-slate truncate">{answer}</span>
                  )}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-text-muted shrink-0 transition-transform ${
                    open ? "" : "-rotate-90"
                  }`}
                  aria-hidden
                />
              </button>

              {open && (
                <div className="pb-4 pl-7.5">
                  <p className="text-caption text-text-muted mt-0 mb-2.5">{question.why}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {question.chips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => void save({ ...answers, [question.id]: chip })}
                        aria-pressed={answer === chip}
                        className={`rounded-full px-3 py-1.5 text-caption font-semibold cursor-pointer border transition-colors ${
                          answer === chip
                            ? "border-violet bg-violet-tint text-ink"
                            : "border-line bg-white text-slate hover:border-ink"
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <input
                    value={answer}
                    onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                    onBlur={() => void save(answers)}
                    placeholder={t.welcome.orSay}
                    aria-label={question.ask}
                    className="w-full bg-white border border-line rounded-sm px-3 py-2.5 text-small text-ink outline-none focus:border-violet"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5 mt-4 flex-wrap">
        <Button
          size="sm"
          icon={Sparkles}
          disabled={done === 0 || busy}
          loading={drafting}
          onClick={() => void draft()}
        >
          {t.welcome.write}
        </Button>
        <span className="text-caption text-text-muted">{t.welcome.writeHint}</span>
      </div>

      <ActionError error={error} />
    </div>
  );
}
