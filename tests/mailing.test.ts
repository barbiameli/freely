import { describe, it, expect } from "vitest";
import { recentAccounts, subscribedCount, type Account } from "@/lib/mailing";

/**
 * The two lists on Insights, and why they stay two lists.
 *
 * Every account's address is stored, because signing in needs one, and looking
 * at them is how you know who is using Freely. Writing to any of them is a
 * separate act that needs a separate yes. The danger is not the storing, it is
 * the moment somebody copies the wrong list into a mail tool, so the copying
 * only exists on the list that consented.
 */
describe("accounts, which is everybody", () => {
  const accounts: Account[] = [
    { email: "a@example.com", since: new Date("2026-01-10"), subscribed: false },
    { email: "b@example.com", since: new Date("2026-03-02"), subscribed: true },
    { email: "c@example.com", since: new Date("2026-02-14"), subscribed: false },
  ];

  it("counts the ones who agreed to hear from you", () => {
    expect(subscribedCount(accounts)).toBe(1);
  });

  it("counts nobody in an empty list rather than throwing", () => {
    expect(subscribedCount([])).toBe(0);
  });

  it("puts the newest signup first", () => {
    expect(recentAccounts(accounts).map((a) => a.email)).toEqual([
      "b@example.com",
      "c@example.com",
      "a@example.com",
    ]);
  });

  it("does not reorder the list it was given", () => {
    const original = [...accounts];
    recentAccounts(accounts);
    expect(accounts).toEqual(original);
  });

  it("caps the list, since this is a page rather than an export", () => {
    expect(recentAccounts(accounts, 2)).toHaveLength(2);
  });
});

import {
  addressList,
  reach,
  optInRate,
  summarise,
  failures,
  sourceLabel,
  MIN_FOR_RATE,
  type Subscriber,
  type SendRow,
} from "@/lib/mailing";

const sub = (email: string): Subscriber => ({ email, since: null, source: null });

const send = (over: Partial<SendRow> = {}): SendRow => ({
  to: "a@b.com",
  kind: "MARKETING",
  status: "SENT",
  createdAt: new Date(2026, 7, 1),
  error: null,
  ...over,
});

describe("addressList", () => {
  it("joins them the way a mail tool expects", () => {
    expect(addressList([sub("a@b.com"), sub("c@d.com")])).toBe("a@b.com, c@d.com");
  });

  it("sends to the same person once", () => {
    // Two accounts can share an address through a team invite, and sending the
    // same person the same email twice is the fastest way to be marked spam.
    expect(addressList([sub("A@b.com"), sub("a@b.com "), sub("c@d.com")])).toBe(
      "a@b.com, c@d.com"
    );
  });

  it("has nothing to say about nobody", () => {
    expect(addressList([])).toBe("");
    expect(reach([])).toBe(0);
  });

  it("ignores blanks rather than emitting a stray comma", () => {
    expect(addressList([sub("a@b.com"), sub("   ")])).toBe("a@b.com");
  });
});

describe("optInRate", () => {
  it("refuses a percentage off a handful of people", () => {
    // Same rule the rest of Insights follows: it will be believed and it means
    // nothing.
    expect(optInRate(1, MIN_FOR_RATE - 1)).toBeNull();
  });

  it("gives one once there is enough", () => {
    expect(optInRate(5, 20)).toBe(25);
  });

  it("survives an empty database", () => {
    expect(optInRate(0, 0)).toBeNull();
  });
});

describe("summarise", () => {
  it("counts skipped apart from failed", () => {
    // Skipped means consent said no, or a nudge was suppressed as too soon.
    // That is the system working, and lumping it in with failures would make
    // a healthy week look broken.
    const rows = [
      send({ status: "SENT" }),
      send({ status: "SKIPPED" }),
      send({ status: "SKIPPED" }),
      send({ status: "FAILED" }),
    ];
    expect(summarise(rows)).toEqual({ sent: 1, failed: 1, skipped: 2 });
  });

  it("is all zeros with nothing sent", () => {
    expect(summarise([])).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });
});

describe("failures", () => {
  it("surfaces only what actually failed, newest first", () => {
    // A bounced password reset is somebody locked out of their account, and it
    // is invisible in a list where nine rows in ten say SENT.
    const rows = [
      send({ status: "FAILED", to: "old@b.com", createdAt: new Date(2026, 7, 1) }),
      send({ status: "SENT" }),
      send({ status: "FAILED", to: "new@b.com", createdAt: new Date(2026, 7, 9) }),
    ];
    expect(failures(rows).map((r) => r.to)).toEqual(["new@b.com", "old@b.com"]);
  });

  it("caps the list", () => {
    const rows = Array.from({ length: 30 }, () => send({ status: "FAILED" }));
    expect(failures(rows)).toHaveLength(10);
  });
});

describe("sourceLabel", () => {
  it("turns an identifier into words", () => {
    expect(sourceLabel("signup_form")).toBe("Signup form");
  });

  it("says something rather than nothing", () => {
    expect(sourceLabel(null)).toBe("Unknown");
  });
});
