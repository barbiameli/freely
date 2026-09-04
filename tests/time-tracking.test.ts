import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  accuracyOf,
  billsFromTime,
  estimateHabit,
  habitInstruction,
  learnsFromTime,
  minutesBetween,
  modeForProject,
  parseTimeMode,
  sayHours,
  thresholdReached,
  toHours,
  totals,
  tracksTime,
} from "@/lib/time-tracking";

/**
 * Where the hours went.
 *
 * Freely quoted in hours and never learned what the hours were, so somebody
 * who runs a third over on every design system job priced the next one the
 * same way. And the "billed by the hour" option promised a client they pay for
 * hours actually worked, which the app had no way to know.
 */
describe("what tracking is for", () => {
  it("is a dial, and each step includes the one before", () => {
    expect(tracksTime("OFF")).toBe(false);
    expect(tracksTime("RECORD")).toBe(true);
    expect(learnsFromTime("RECORD")).toBe(false);
    expect(learnsFromTime("LEARN")).toBe(true);
    expect(billsFromTime("LEARN")).toBe(false);
    expect(billsFromTime("BILLING")).toBe(true);
    // Turning it up never takes anything away.
    expect(tracksTime("BILLING")).toBe(true);
    expect(learnsFromTime("BILLING")).toBe(true);
  });

  it("treats anything it does not recognise as off", () => {
    expect(parseTimeMode("EVERYTHING")).toBe("OFF");
    expect(parseTimeMode(null)).toBe("OFF");
  });
});

describe("who decides, per engagement", () => {
  it("uses the project's own answer when it has one", () => {
    expect(
      modeForProject({ timeTracking: "BILLING" }, { timeTracking: "RECORD", timeTrackingAsk: false })
    ).toBe("BILLING");
  });

  it("asks again by default rather than assuming the last answer generalises", () => {
    expect(modeForProject({}, { timeTracking: "LEARN", timeTrackingAsk: true })).toBeNull();
  });

  it("uses the default once somebody has said to stop asking", () => {
    expect(modeForProject({}, { timeTracking: "LEARN", timeTrackingAsk: false })).toBe("LEARN");
  });

  it("still asks when the saved default is off", () => {
    // "Off by default" and "decide each time" are the same thing here, and a
    // silent OFF would hide the button that offers to set it up.
    expect(modeForProject({}, { timeTracking: "OFF", timeTrackingAsk: false })).toBeNull();
  });
});

describe("counting", () => {
  it("measures a stretch in whole minutes", () => {
    expect(minutesBetween("2026-09-04T09:00:00Z", "2026-09-04T10:30:00Z")).toBe(90);
  });

  it("never goes backwards", () => {
    expect(minutesBetween("2026-09-04T10:00:00Z", "2026-09-04T09:00:00Z")).toBe(0);
  });

  it("says hours the way a person would", () => {
    expect(sayHours(200)).toBe("3h 20m");
    expect(sayHours(45)).toBe("45m");
    expect(sayHours(120)).toBe("2h");
    expect(sayHours(0)).toBe("0m");
  });

  it("rounds to what an invoice line wants", () => {
    expect(toHours(90)).toBe(1.5);
    expect(toHours(100)).toBe(1.75);
    expect(toHours(0)).toBe(0);
  });

  it("keeps billable time apart from the rest", () => {
    // Reading a brief before quoting is real time and is not chargeable, and
    // counting it would flatter the effective rate.
    const out = totals([
      { minutes: 60, billable: true, startedAt: "" },
      { minutes: 30, billable: false, startedAt: "" },
    ]);
    expect(out.minutes).toBe(90);
    expect(out.billableMinutes).toBe(60);
    expect(out.entries).toBe(2);
  });
});

describe("how the estimate held up", () => {
  it("says how far over, as a percentage", () => {
    const out = accuracyOf(10, 13 * 60);
    expect(out?.percent).toBe(30);
    expect(out?.actual).toBe(13);
  });

  it("says nothing about a project with no estimate", () => {
    expect(accuracyOf(0, 600)).toBeNull();
    expect(accuracyOf(10, 0)).toBeNull();
  });

  it("counts coming in under as under", () => {
    expect(accuracyOf(10, 8 * 60)?.percent).toBe(-20);
  });
});

describe("the habit across projects", () => {
  const over = (n: number) =>
    Array.from({ length: n }, () => ({ quotedHours: 10, actualMinutes: 13 * 60 }));

  it("says nothing from one or two projects", () => {
    // One project over is a project. Four in a row is a pricing habit.
    expect(estimateHabit(over(2))).toBeNull();
  });

  it("finds the habit once there are enough", () => {
    expect(estimateHabit(over(4))?.percent).toBe(30);
  });

  it("stays quiet about an overrun small enough to be ordinary", () => {
    // Telling somebody they run 4% over is noise dressed as insight, and it
    // makes the useful version easier to ignore.
    const small = Array.from({ length: 5 }, () => ({
      quotedHours: 10,
      actualMinutes: 10.4 * 60,
    }));
    expect(estimateHabit(small)).toBeNull();
  });

  it("uses the median, so one runaway project does not set the rule", () => {
    const mostly = [
      { quotedHours: 10, actualMinutes: 12 * 60 },
      { quotedHours: 10, actualMinutes: 12 * 60 },
      { quotedHours: 10, actualMinutes: 12 * 60 },
      { quotedHours: 10, actualMinutes: 80 * 60 },
    ];
    expect(estimateHabit(mostly)?.percent).toBe(20);
  });
});

describe("what the model is told", () => {
  const habit = estimateHabit(
    Array.from({ length: 4 }, () => ({ quotedHours: 10, actualMinutes: 13 * 60 }))
  );

  it("says nothing below the mode that asked for it", () => {
    expect(habitInstruction(habit, "RECORD")).toBe("");
    expect(habitInstruction(habit, "LEARN")).not.toBe("");
  });

  it("is a correction to apply, not a number to copy", () => {
    const out = habitInstruction(habit, "LEARN");
    expect(out).toContain("Estimate the hours this job honestly needs, then adjust");
  });

  it("never lets tracked time reach the client", () => {
    // A quote that mentions how long past projects took is a quote arguing
    // with itself in front of the person paying.
    expect(habitInstruction(habit, "BILLING")).toContain(
      "Do not mention tracked time, past projects or this correction anywhere in the quote"
    );
  });
});

describe("the threshold an hourly quote promises", () => {
  it("fires at 80% of the estimate", () => {
    expect(thresholdReached(10, 7 * 60)).toBe(false);
    expect(thresholdReached(10, 8 * 60)).toBe(true);
  });

  it("cannot fire on a job with no estimate", () => {
    expect(thresholdReached(0, 100 * 60)).toBe(false);
  });
});

describe("how the app uses it", () => {
  const actions = readFileSync("src/actions/time.ts", "utf8");
  const panel = readFileSync("src/components/track/time-panel.tsx", "utf8");

  it("asks once per engagement rather than switching it on for the account", () => {
    expect(actions).toContain("setProjectTimeModeAction");
    expect(panel).toContain("t.track.timeSetUp");
  });

  it("offers to reuse the answer rather than assuming it generalises", () => {
    expect(actions).toContain("asDefault");
    expect(actions).toContain("timeTrackingAsk: false");
  });

  it("starting a second timer stops the first", () => {
    // Somebody who has moved on has moved on; making them find the old timer
    // is a rule that exists for the database rather than for them.
    expect(actions).toContain("await stopRunning(user.id);");
  });

  it("throws away a misclick rather than logging it", () => {
    // Ten seconds, not a minute: a minute threw away the shortest real thing
    // anybody does, like two minutes on a call or forty seconds fixing a typo.
    expect(actions).toContain("secondsOf(stopped) < 10");
  });

  it("cannot count one calendar block twice", () => {
    expect(actions).toContain("skipDuplicates: true");
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toContain("@@unique([userId, calendarEventId])");
  });

  it("only claims calendar blocks that name the project or the client", () => {
    // On whole words, and never on a name too short to be one: a substring
    // match claimed "Ergonomics workshop" for a client called Ergo.
    expect(actions).toContain("needle.length >= 4");
    expect(actions).toContain("GENERIC_CLIENTS");
    expect(actions).toContain("escapeRegex(needle)");
  });

  it("never lets a calendar failure lose somebody's afternoon", () => {
    const calendar = readFileSync("src/lib/google-calendar.ts", "utf8");
    expect(calendar).toContain("Timed events only");
    expect(actions).toContain("The event is best effort and never blocks the stop");
  });
});
