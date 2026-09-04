"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Lightbulb, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { clearQuestionAction, acknowledgeRuleAction, applyRuleAction } from "@/actions/briefs";
import { useT } from "@/lib/i18n/context";
import type { GroundRule } from "@/lib/ground-rules";
import { ruleWords } from "@/lib/rule-words";

/**
 * The questions the AI raised, as a list you can finish.
 *
 * These used to hold a column of their own beside the quote, which gave five
 * private notes the same weight as the document going to the client and left
 * a wall of text where the quote should be. So they moved into an overlay.
 *
 * It opens itself once, a couple of seconds after the quote first appears,
 * because that is the moment the questions are worth reading and nobody goes
 * looking for a button they have not seen yet. After that it is a small
 * "Before you send" control carrying the count, and the list is one press away
 * whenever it is wanted.
 *
 * Dismissing is escape, the close, or the backdrop, and dismissing settles
 * nothing: the count stays until each line is actually ticked.
 *
 * Publishing is never blocked. You are the one who knows whether a question
 * matters, and half of them will be things you already had in hand. A count
 * you can ignore is honest; a gate you cannot is Freely overruling you about
 * your own quote.
 */
export function BeforeYouSend({
  briefId,
  questions,
  cleared: initialCleared,
  broken = [],
  acknowledged: initialAcknowledged = [],
  onFixed,
}: {
  briefId: string;
  questions: string[];
  /** Which are already ticked, by their text. */
  cleared: string[];
  /**
   * The ground rules this quote breaks.
   *
   * They share the overlay with the AI's questions rather than getting a
   * panel of their own, because they are the same job: the things to settle
   * before this goes to a client. Two lists in two places would mean checking
   * one and forgetting the other.
   */
  broken?: GroundRule[];
  /** Rules already waved through on this quote. */
  acknowledged?: string[];
  /** Runs after a rule has rewritten part of the quote, so the page can
   * refresh and light up what changed. */
  onFixed?: (changed: string[]) => void;
}) {
  const t = useT();
  const [cleared, setCleared] = useState<string[]>(initialCleared);
  const [acknowledged, setAcknowledged] = useState<string[]>(initialAcknowledged);
  const [open, setOpen] = useState(false);
  /** The rule currently being written in, or "all" while every one runs. */
  const [fixing, setFixing] = useState("");
  const [fixError, setFixError] = useState("");
  /**
   * Rules already written into this quote, this visit.
   *
   * The flags are computed from the quote as the page last loaded it, and a
   * clause that has just been added is not in that copy yet. Without this they
   * stayed on screen after being settled, which reads as the button having
   * done nothing.
   */
  const [settled, setSettled] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  const openRules = broken.filter(
    (rule) => !acknowledged.includes(rule.key) && !settled.includes(rule.key)
  );
  const blocking = openRules.filter((rule) => rule.severity === "blocking").length;
  const unchecked = questions.filter((q) => !cleared.includes(q)).length + openRules.length;
  const hasQuestions = questions.length > 0 || broken.length > 0;

  /*
   * This no longer opens itself.
   *
   * It used to appear 2.2 seconds after the quote loaded, once per quote, and
   * that was the right call when the plan step did not exist: there was no
   * earlier moment to raise any of this, so the choice was between a modal and
   * saying nothing. There is an earlier moment now. The plan screen asks about
   * protection, the money the brief wants, the open questions and the sections
   * before a word is written, which is when the answers are cheap.
   *
   * By the time the quote exists, a panel that covers it uninvited is
   * interrupting somebody reading the thing they just made, to tell them
   * something they could have been told before it was made. The count on the
   * button says how many are open; opening it is their decision.
   */

  if (!hasQuestions) return null;

  /**
   * Letting Freely write the missing clause.
   *
   * The whole point of the flag. Naming a gap and leaving somebody to write
   * the sentence themselves is most of the work still to do, so this runs the
   * rule's own instruction through the same refine the rest of the page uses
   * and the clause comes back in the quote's voice.
   */
  async function fix(rules: string[]) {
    setFixError("");
    setFixing(rules.length === 1 ? rules[0] : "all");
    const result = await applyRuleAction(briefId, rules);
    setFixing("");
    if (!result.ok) {
      setFixError(result.error);
      return;
    }
    // Gone from the list before the page has caught up, because the clause is
    // in the quote whatever this copy of it says.
    setSettled((current) => [...current, ...result.data.applied]);
    // Closed on success: the thing to look at is the quote behind this, with
    // the new sections lit up.
    setOpen(false);
    onFixed?.(result.data.changed);
  }

  function wave(rule: string) {
    const already = acknowledged.includes(rule);
    setAcknowledged(already ? acknowledged.filter((r) => r !== rule) : [...acknowledged, rule]);
    startTransition(() => {
      void acknowledgeRuleAction(briefId, rule, !already);
    });
  }

  function toggle(question: string) {
    const next = cleared.includes(question)
      ? cleared.filter((q) => q !== question)
      : [...cleared, question];
    // Set first, save after. A tick that waits on a round trip feels broken,
    // and the worst case here is one checkbox out of step until a reload.
    setCleared(next);
    startTransition(() => {
      void clearQuestionAction(briefId, question, !cleared.includes(question));
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        // Held bright while the list is up, so the overlay reads as belonging
        // to this control rather than as something the page did on its own.
        // Above the overlay, so it stays sharp while everything behind it
        // softens and the list reads as belonging to this control. Pressing it
        // again closes, since that is what a control that looks pressed should
        // do.
        className={`relative z-[60] inline-flex items-center gap-1.5 rounded-full border transition-colors px-3 py-1.5 cursor-pointer tap-row ${
          open
            ? "border-white bg-white text-ink"
            : "border-white/25 bg-white/10 hover:bg-white/20 text-white/85"
        }`}
      >
        <Lightbulb size={13} className="shrink-0" />
        <span className="font-body font-semibold text-caption">{t.brief.beforeYouSend}</span>
        {unchecked > 0 && (
          <span className="font-body font-bold text-caption bg-coral text-white rounded-full min-w-[17px] h-[17px] px-1 flex items-center justify-center shrink-0">
            {unchecked}
          </span>
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t.brief.beforeYouSend}
        hint={
          unchecked === 0
            ? t.brief.beforeYouSendDone
            : (blocking > 0
                ? t.brief.beforeYouSendBlocked
                : t.brief.beforeYouSendOpen
              ).replace("{count}", String(unchecked))
        }
        wide
      >
        {/* Rules first. A question is something to think about; a broken rule
            is something a client will write back about. */}
        {openRules.length > 0 && (
          <div className="flex flex-col gap-3 mb-5">
            {blocking > 0 && (
              <p className="font-body font-semibold text-caption text-overdue m-0 text-pretty">
                {t.rules.blockedNotice}
              </p>
            )}
            {fixError && (
              <p className="font-body font-semibold text-caption text-overdue m-0">{fixError}</p>
            )}

            {/* One pass for all of them. Settling five used to be five full
                rewrites of the quote, run one after another, each re-reading
                what the last had just written. */}
            {openRules.length > 1 && (
              <button
                type="button"
                disabled={Boolean(fixing)}
                onClick={() => void fix(openRules.map((rule) => rule.key))}
                className="self-start font-body font-semibold text-caption text-white bg-violet border-none rounded-full px-3.5 py-2 cursor-pointer tap disabled:opacity-60"
              >
                {fixing === "all"
                  ? t.rules.flagFixing
                  : t.rules.flagFixAll.replace("{count}", String(openRules.length))}
              </button>
            )}
            {openRules.map((rule) => {
              const words = ruleWords(rule.key, t);
              return (
                <div
                  key={rule.key}
                  className={`rounded-card border-l-[3px] px-4 py-3.5 ${
                    rule.severity === "blocking"
                      ? "bg-coral-tint border-coral"
                      : "bg-violet-tint border-violet"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {rule.severity === "blocking" && (
                      <AlertTriangle size={14} className="text-coral shrink-0 mt-[3px]" />
                    )}
                    <div className="min-w-0">
                      <div className="font-body font-bold text-small text-ink text-pretty">
                        {words.title}
                      </div>
                      <p className="text-caption text-slate mt-1 mb-0 text-pretty">{words.why}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-2.5">
                    <button
                      type="button"
                      disabled={Boolean(fixing)}
                      onClick={() => void fix([rule.key])}
                      className="font-body font-semibold text-caption text-white bg-violet border-none rounded-full px-3 py-1.5 cursor-pointer tap disabled:opacity-60"
                    >
                      {fixing === rule.key ? t.rules.flagFixing : t.rules.flagFix}
                    </button>
                    <button
                      type="button"
                      onClick={() => wave(rule.key)}
                      className="text-meta font-semibold text-violet bg-none border-none cursor-pointer p-0 tap"
                    >
                      {t.rules.flagIgnore}
                    </button>
                    <Link
                      href="/memory?tab=rules"
                      className="text-meta font-semibold text-slate no-underline tap"
                    >
                      {t.rules.seeRule}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <ul className="list-none p-0 m-0 flex flex-col">
          {questions.map((question) => {
            const done = cleared.includes(question);
            return (
              <li key={question} className="border-b border-line/70 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggle(question)}
                  aria-pressed={done}
                  className="w-full flex items-start gap-2.5 text-left bg-none border-none cursor-pointer p-0 py-3 tap-row"
                >
                  <span
                    className={`mt-[2px] w-[15px] h-[15px] rounded border shrink-0 flex items-center justify-center transition-colors ${
                      done ? "bg-violet border-violet" : "bg-white border-line"
                    }`}
                  >
                    {done && <Check size={10} strokeWidth={3.5} className="text-white" />}
                  </span>
                  <span
                    className={`text-small leading-relaxed text-pretty ${
                      done ? "text-text-muted line-through" : "text-slate"
                    }`}
                  >
                    {question}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
}
