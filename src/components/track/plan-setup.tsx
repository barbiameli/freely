"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, SubLabel } from "@/components/ui/label";
import { ActionError } from "@/components/ui/action-error";
import { useT } from "@/lib/i18n/context";
import { planProjectAction } from "@/actions/board";

/**
 * The four facts a plan needs, asked once.
 *
 * The board and the timeline both opened empty, so the first thing anybody
 * saw on a new project was a blank grid and a pile of unplaced pills. Editing
 * is easy and starting is not: this asks when the work runs, how long a day
 * is, which days are working days and which deliverables deserve more of the
 * time, then lays down a plan to argue with.
 *
 * Everything here has a defensible default, so somebody who agrees with all
 * of it presses one button.
 */
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function PlanSetup({
  projectId,
  deliverables,
  startDate,
  dueDate,
}: {
  projectId: string;
  deliverables: { id: string; name: string }[];
  startDate: string | null;
  dueDate: string | null;
}) {
  const t = useT();
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(startDate ? startDate.slice(0, 10) : today);
  const [end, setEnd] = useState(dueDate ? dueDate.slice(0, 10) : "");
  const [hours, setHours] = useState("6");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [starred, setStarred] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()
    );
  }

  async function plan() {
    setWorking(true);
    setError("");
    const result = await planProjectAction({
      projectId,
      startDay: start,
      endDay: end,
      hoursPerDay: Number(hours) || 6,
      workingDays: days,
      starred,
    });
    setWorking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <Label>{t.track.planSetupTitle}</Label>
      <p className="text-caption text-slate mt-1 mb-4 max-w-prose text-pretty">
        {t.track.planSetupHint}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <SubLabel>{t.track.planStarts}</SubLabel>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <SubLabel>{t.track.planEnds}</SubLabel>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <SubLabel>{t.track.planHoursADay}</SubLabel>
          <input
            type="number"
            min={1}
            max={16}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="bg-paper rounded-lg border-none px-3 py-2.5 text-sm text-ink outline-none"
          />
        </label>
      </div>

      <div className="mt-4">
        <SubLabel>{t.track.planWorkingDays}</SubLabel>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {WEEKDAY_KEYS.map((key, index) => {
            const on = days.includes(index);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleDay(index)}
                aria-pressed={on}
                className={`rounded-full px-3 py-1.5 text-caption font-semibold border cursor-pointer tap ${
                  on ? "bg-violet text-white border-violet" : "bg-white text-slate border-line"
                }`}
              >
                {t.weekdays[key]}
              </button>
            );
          })}
        </div>
      </div>

      {deliverables.length > 0 && (
        <div className="mt-4">
          <SubLabel>{t.track.planStarHint}</SubLabel>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {deliverables.map((deliverable) => {
              const on = starred.includes(deliverable.id);
              return (
                <button
                  key={deliverable.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setStarred((current) =>
                      current.includes(deliverable.id)
                        ? current.filter((id) => id !== deliverable.id)
                        : [...current, deliverable.id]
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold border cursor-pointer tap text-pretty text-left ${
                    on ? "bg-amber-tint text-amber border-amber" : "bg-white text-slate border-line"
                  }`}
                >
                  <Star size={12} fill={on ? "currentColor" : "none"} />
                  {deliverable.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap mt-5">
        <Button icon={Wand2} loading={working} onClick={() => void plan()} disabled={!end}>
          {t.track.planSetupGo}
        </Button>
        <ActionError error={error} />
      </div>
    </Card>
  );
}
