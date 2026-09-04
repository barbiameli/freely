"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/ui/action-error";
import { tryReadingAction } from "@/actions/testing";

/**
 * A workbench for the reading step.
 *
 * Tuning the plan prompt meant generating a whole quote each time: two model
 * calls, a stored brief, a client record and a row in the list, to look at a
 * paragraph and five section names. So it got tuned rarely, and by guesswork.
 *
 * Paste a brief, press it, read exactly what came back. Nothing is written
 * down, so the same brief can be run twenty times while a sentence in the
 * prompt is being argued with.
 *
 * Deliberately raw. This is the shape the wizard consumes, and a prettier
 * rendering would hide the thing being debugged: an empty array, a section
 * key that does not exist, a risk phrased in the client's voice rather than
 * the freelancer's.
 */
export function ReadingCard() {
  const [source, setSource] = useState("");
  const [instructions, setInstructions] = useState("");
  const [client, setClient] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{ plan: unknown; ms: number } | null>(null);

  async function run() {
    setError("");
    setReason("");
    setResult(null);
    setWorking(true);
    const answer = await tryReadingAction({ sourceText: source, instructions, client });
    setWorking(false);
    if (!answer.ok) {
      setError(answer.error);
      setReason(answer.reason ?? "");
      return;
    }
    setResult(answer.data);
  }

  return (
    <Card tone="quiet">
      <CardHeader
        title={<>Try a brief</>}
        hint={
          <>
            Runs the reading step and shows what came back. Nothing is saved, no quote is
            written, and only you can see this.
          </>
        }
      />

      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        rows={6}
        placeholder="Paste a brief."
        className="w-full font-body text-small text-ink leading-relaxed bg-white border border-line rounded-lg px-3 py-2.5 outline-none focus:border-violet"
      />

      <div className="flex flex-wrap gap-2 mt-2">
        <input
          type="text"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          placeholder="Client (optional)"
          className="flex-1 min-w-[160px] bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink outline-none"
        />
        <input
          type="text"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Your instructions (optional)"
          className="flex-[2] min-w-[200px] bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink outline-none"
        />
      </div>

      <div className="flex items-center gap-3 mt-3">
        <Button
          icon={Sparkles}
          loading={working}
          disabled={source.trim().length < 20}
          onClick={() => void run()}
        >
          Read it
        </Button>
        <span className="text-caption text-text-muted">{source.trim().length} characters</span>
      </div>

      <ActionError error={error} className="mt-3" />
      {reason && (
        <p className="text-caption text-text-muted mt-1 mb-0">
          Reason: {reason}
        </p>
      )}

      {result && (
        <div className="mt-4">
          <div className="text-caption text-text-muted mb-1.5">Took {result.ms}ms</div>
          <pre className="text-caption text-ink bg-white border border-line rounded-lg p-3 overflow-auto max-h-[420px] whitespace-pre-wrap break-words m-0">
            {JSON.stringify(result.plan, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}
