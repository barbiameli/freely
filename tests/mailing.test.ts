import { describe, it, expect } from "vitest";
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
