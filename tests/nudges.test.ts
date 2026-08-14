import { describe, it, expect } from "vitest";
import {
  nudgeFor,
  MIN_HOURS_BETWEEN_NUDGES,
  MIN_DAYS_BETWEEN_SAME_SUBJECT,
  QUIET_DAYS_AFTER_SIGNUP,
  type NudgeInput,
} from "@/lib/nudges";

// A Wednesday, so the weekend rule is not accidentally doing the work in
// every other test.
const NOW = new Date("2026-08-12T09:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
const ahead = (days: number) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

function input(over: Partial<NudgeInput> = {}): NudgeInput {
  return {
    now: NOW,
    createdAt: ago(60),
    nudgeEmails: true,
    lastNudgeAt: null,
    lastBySubject: {},
    quotes: [],
    deliverables: [],
    ...over,
  };
}

const SIGNED_UNTRACKED = {
  id: "b1",
  title: "Brand refresh",
  client: "Aurora",
  since: ago(4),
  tracked: false,
  accepted: true,
};

const OVERDUE = {
  id: "d1",
  name: "Site audit",
  projectId: "p1",
  projectTitle: "Briefer",
  dueAt: ago(2),
  done: false,
};

describe("when nothing should be sent", () => {
  it("says nothing when there is nothing to say", () => {
    expect(nudgeFor(input())).toBeNull();
  });

  it("respects somebody who turned them off", () => {
    expect(nudgeFor(input({ nudgeEmails: false, deliverables: [OVERDUE] }))).toBeNull();
  });

  it("stays quiet at the weekend", () => {
    // A tracker reminder on a Sunday morning is not a service.
    const sunday = new Date("2026-08-16T09:00:00Z");
    const saturday = new Date("2026-08-15T09:00:00Z");
    expect(nudgeFor(input({ now: sunday, deliverables: [OVERDUE] }))).toBeNull();
    expect(nudgeFor(input({ now: saturday, deliverables: [OVERDUE] }))).toBeNull();
  });

  it("leaves a new account alone", () => {
    // Somebody who signed up yesterday is being reminded about a habit they
    // have not formed yet.
    expect(
      nudgeFor(input({ createdAt: ago(QUIET_DAYS_AFTER_SIGNUP - 1), deliverables: [OVERDUE] }))
    ).toBeNull();
  });

  it("sends at most one a day", () => {
    // Two things being wrong at once is not a reason to write twice.
    const recent = new Date(NOW.getTime() - (MIN_HOURS_BETWEEN_NUDGES - 1) * 3600_000);
    expect(nudgeFor(input({ lastNudgeAt: recent, deliverables: [OVERDUE] }))).toBeNull();
  });

  it("is happy again once a day has passed", () => {
    const old = new Date(NOW.getTime() - (MIN_HOURS_BETWEEN_NUDGES + 1) * 3600_000);
    expect(nudgeFor(input({ lastNudgeAt: old, deliverables: [OVERDUE] }))?.kind).toBe(
      "NUDGE_OVERDUE"
    );
  });

  it("does not raise the same subject two days running", () => {
    // If they did not act the first time, the second time is nagging.
    const seen = { p1: ago(MIN_DAYS_BETWEEN_SAME_SUBJECT - 1) };
    expect(nudgeFor(input({ deliverables: [OVERDUE], lastBySubject: seen }))).toBeNull();
  });

  it("will raise it again after long enough", () => {
    const seen = { p1: ago(MIN_DAYS_BETWEEN_SAME_SUBJECT + 1) };
    expect(nudgeFor(input({ deliverables: [OVERDUE], lastBySubject: seen }))?.kind).toBe(
      "NUDGE_OVERDUE"
    );
  });

  it("ignores work that is already ticked", () => {
    expect(nudgeFor(input({ deliverables: [{ ...OVERDUE, done: true }] }))).toBeNull();
  });

  it("ignores a quote that is already tracked", () => {
    expect(nudgeFor(input({ quotes: [{ ...SIGNED_UNTRACKED, tracked: true }] }))).toBeNull();
  });

  it("says nothing about a quote nobody has signed", () => {
    // An unsigned quote sitting there is normal. Most quotes are not won, and
    // emailing about every one would be emailing about the ordinary case.
    expect(nudgeFor(input({ quotes: [{ ...SIGNED_UNTRACKED, accepted: false }] }))).toBeNull();
  });
});

describe("what it picks", () => {
  it("leads with money and a client waiting", () => {
    // Overdue beats everything: it is the one that costs something today.
    const nudge = nudgeFor(
      input({ deliverables: [OVERDUE, { ...OVERDUE, id: "d2", dueAt: ahead(1) }], quotes: [SIGNED_UNTRACKED] })
    );
    expect(nudge?.kind).toBe("NUDGE_OVERDUE");
    expect(nudge?.title).toBe("Site audit");
  });

  it("then the signed quote that never reached Track", () => {
    // The gap this app exists to close.
    const nudge = nudgeFor(input({ quotes: [SIGNED_UNTRACKED] }));
    expect(nudge?.kind).toBe("NUDGE_TRACK_QUOTE");
    expect(nudge?.path).toBe("/quote/b1");
  });

  it("then something merely coming up", () => {
    const nudge = nudgeFor(input({ deliverables: [{ ...OVERDUE, dueAt: ahead(1) }] }));
    expect(nudge?.kind).toBe("NUDGE_DUE_SOON");
  });

  it("says nothing about a date that is still weeks off", () => {
    expect(nudgeFor(input({ deliverables: [{ ...OVERDUE, dueAt: ahead(20) }] }))).toBeNull();
  });

  it("picks the oldest overdue one, not a random one", () => {
    const older = { ...OVERDUE, id: "d0", name: "First thing", dueAt: ago(9) };
    expect(nudgeFor(input({ deliverables: [OVERDUE, older] }))?.title).toBe("First thing");
  });

  it("counts the others so the email can mention them", () => {
    const nudge = nudgeFor(
      input({
        deliverables: [
          OVERDUE,
          { ...OVERDUE, id: "d2", projectId: "p2" },
          { ...OVERDUE, id: "d3", projectId: "p3" },
        ],
      })
    );
    expect(nudge?.others).toBe(2);
  });

  it("does not count subjects it is not allowed to mention", () => {
    // Otherwise "and 2 more" includes things being deliberately held back.
    const nudge = nudgeFor(
      input({
        deliverables: [OVERDUE, { ...OVERDUE, id: "d2", projectId: "p2" }],
        lastBySubject: { p2: ago(1) },
      })
    );
    expect(nudge?.others).toBe(0);
  });

  it("gives every nudge a subject to log against", () => {
    // Without one, the log cannot stop it repeating tomorrow.
    for (const state of [
      input({ deliverables: [OVERDUE] }),
      input({ quotes: [SIGNED_UNTRACKED] }),
      input({ deliverables: [{ ...OVERDUE, dueAt: ahead(1) }] }),
    ]) {
      expect(nudgeFor(state)?.subjectId).toBeTruthy();
    }
  });
});
